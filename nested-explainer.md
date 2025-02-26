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
    ::view-transition-image-pair(container)
      ::view-transition-old(container)
      ::view-transition-new(container)
  ::view-transition-group(icon)
    ::view-transition-image-pair(icon)
      ::view-transition-old(icon)
      ::view-transition-new(icon)
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
      ::view-transition-old(container)
      ::view-transition-new(container)
    ::view-transition-group(icon)
      ::view-transition-image-pair(icon)
        ::view-transition-old(icon)
        ::view-transition-new(icon)
```

Note that for the pseudo-element to clip its children, we still need to explicitly copy the `clip-path` property in this case.
So by itself, `view-transition-group` allows for the previously unachievable visual effect, but it does require developers to
apply relevant clipping/effects to the view transition pseudo tree.

# Alternatives

There are no readily available alternatives, since view transitions flattens the pseudo element tree that is built.
Another solution to general clipping and having a slightly different effect is Scoped View Transitions which addresses
different issues, and is also being pursued separately.
