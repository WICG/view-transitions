# Explainer: Nested View Transitions & Capture Modes

# Overview
[view transitions](https://www.w3.org/TR/css-view-transitions-1/) work by generating a pseudo-element tree representing groups of the captured old state & the live new state of a transition.
In its current form, the generated tree is "flat" - the original hierarchy in the DOM is lost, and all the captured groups are siblings under a single `::view-transition` pseudo-element.

This is sufficient for many use cases, but not for all. Some CSS features rely on the nested nature of the DOM tree. To name a few:
* Clipping (`overflow`, `clip-path`, `border-radius`) applies to the whole tree rather than to each element individually.
* 3D (`transform`, `transform-style`, `perspective`, ...): flattening the tree loses the 3D relationship between the elements.
* Masking & effects (`opacity`, `mask-image`, `filter`): these effects change their visual output when applied to each element individually vs. being applied to the tree.

When any of the above features is used, view transitions start to feel constrained. Apart from the fact that not all animation styles are possible,
some animations would look "broken" by default, e.g. elements abruptly lose their clip for the duration of the transition.

# Proposed solutions

The solution is based on two features. They are completely decoupled from each other, but work together to address the use case.

## Nested view transitiions
Instead of a flat tree, the author can nest `::view-transition-group` pseudo-elements within each other.
This is done with a new property, `view-transition-group`, which when applied on an element with a `view-transition-name`, defines whether the generated `::view-transition-group` gets nested in one of its containers,
or it would nest its own participating descendants.

The generated pseudo-element tree would now be nested.
Example:

HTML:
```html
  <section class="container">
    <img class="icon">
  </section>
```

CSS:
```css
.container {
  clip-path: circle();
  view-transition-name: container;
}

.icon {
  view-transition-name: icon;
}
```

Result:
```
// container does not clip icon
::view-transition
  ::view-transition-group(container)
    ::view-transition-image-pair(lipping-container)
  ::view-transition-group(icon)
    ::view-transition-image-pair(icon)
```

With `view-transition-group`:
```css
.icon {
  view-transition-group: container; // or `nearest`
}

::view-transition-group(container) {
  clip-path: circle();
}
```

Result:
```
// container clips icon
::view-transition
  ::view-transition-group(container)
    ::view-transition-image-pair(container)
    ::view-transition-group(icon)
      ::view-transition-image-pair(icon)
```

Note that for the pseudo-element to clip its children, we still need to explicitly copy the `clip-path` property in this case.
So by itself, `view-transition-group` allows for the previously unachievable visual effect, but does not solve the problem of the default behavior.
This leads to the next topic.

## Capture modes
In order to correctly crossfade clipped elements, and animate other tree effects like opacity and filters, we can manually apply all the desired properties to the pseudo-elements.
But this is tideous and error-prone. To make this work in a more seamless way, these properties can be copied over from the element, and omitted when the element is captured.

For example, instead of creating a snapshot with the circle clip-path baked in, the style can be adjusted as such that the snapshot would be taken without clipping, and the `clip-path` property
would be copied to the pseudo-elements. This would allow, in this case, animating the circle itself that's clipping the descendants as a path rather than crossfading between two circles of different sizes.

When combined with nested view transitions, this creates an efficient way to create the expected animations without manually applying each CSS property from the captured element to the pseudo-element.

It might look something like:
```css
.container {
  view-transition-group: contain; /* All descendants nest to this one */
  view-transition-style: composite; /* Copy clip & tree-effects to the group style instead of baking them into the snapshot */
}
```

Note that a lot of the details about capture modes have not been fleshed out yet.


