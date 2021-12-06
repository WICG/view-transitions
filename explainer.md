# Introduction

https://user-images.githubusercontent.com/93594/140955654-fa944c4d-530e-4d3c-8286-50864d59bb0d.mp4

When a user navigates on the web, the viewport abruptly switches from Page-A to Page-B, often in some in-progress state. This can include a flash of white, and elements which seem to disappear only to reappear in the same place. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. In addition, it increases the user's perception of loading time as compared with a smooth loading animation. For these reasons, most platforms provide easy-to-use primitives that enable developers to build seamless transitions: [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

Shared Element Transitions provides developers with the same capability on the web, irrespective of whether the transitions are cross-document (MPA) or intra-document (SPA).

# Use-Cases

A visual demo of some example transition patterns targeted by this feature is [here](https://material.io/design/motion/the-motion-system.html#transition-patterns). The following is a summary of the semantics of these transition patterns:

* Root Transitions: The full page content animates between two web pages with an optional static UI element on top. Examples 1 & 2 [here](https://material.io/design/motion/the-motion-system.html#shared-axis) are demonstrations of this.
* Shared Element to Root Transitions: A persistent UI element morphs into the full page content on the next web page. [Container transform](https://material.io/design/motion/the-motion-system.html#container-transform) shows an example.
* Shared Element Transitions: A persistent UI element morphs into another UI element on the next web page. The element's contents and shape can change during this transition. This [video](https://www.youtube.com/watch?v=SGnZN3NE0jA) shows an example.
* Entry/Exit Transitions: A UI element animates as it exits or enters the screen. This [issue](https://github.com/WICG/shared-element-transitions/issues/37) shows an example.

# Design

The goal is to provide a mechanism and API which will allow simple transitions like above to be specified in CSS, building on CSS animations, but also allow for more complex transitions to be performed via JavaScript, building on the Web Animations API.

This section covers the concepts and mechanisms, while a later section looks at possible API shapes.

Performing a transition from Page-A to Page-B requires parts of both to be on screen at the same time, potentially moving independently. This is currently impossible in a cross-document navigation, but it's still hard in an SPA (single page app) navigation. You need to make sure that the outgoing state persists along with the incoming state, that it can't receive additional interactions, and ensure the presence of both states doesn't create a confusing experience for those using accessibility technology.

The aim of this design is to allow for representations of both Page-A and Page-B to exist at the same time, without the usability, accessibility, performance, security and memory concerns of having both complete DOM trees alive.

Here's the example that will be used to explain the design:

<img alt="Page-A and Page-B" src="media/pages.png?raw=true">

The concepts and process described in this section apply for both MPA and SPA transition, however the API will differ in parts.

Cross-origin transitions are something we want to tackle, but may have significant differences and restrictions for security reasons. Cross-origin transitions are not covered in this document.

## Part 1: The offering

Before Page-A goes away, it offers up elements to be used in the transition. Generally, this will mean an element that animates independently during the transition. For the example transition, the elements are:

- The header
- The share button
- The rest (referred to as the page root)

https://user-images.githubusercontent.com/93594/141104275-6d1fb67a-2f73-41e4-9cef-14676798223b.mp4

Aside from the root, an element offered for a transition has the following restrictions:

- [`contain: paint`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain) which ensures that the element is the containing block for all positioned descendants and generates a stacking context. This implies that the child content will be clipped to the context-box but it can be expanded using ['overflow-clip-margin'](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-clip-margin). Being a stacking context and a containing block allows the element to be treated as a single unit, whereas paint containment simplifies implementation.
- [`break-inside: avoid`](https://developer.mozilla.org/en-US/docs/Web/CSS/break-inside) which disallows fragmentation ensuring the element content is a single rect, i.e., it doesn't break across lines or columns, again allowing the element to be treated as a single unit.

The developer must add the properties above to an element's style if its offered for a transition. This constraint is verified during style resolution for all rendering lifecycle updates during a transition. If not satisfied, the transition is aborted. See [issue](https://github.com/WICG/shared-element-transitions/issues/71) for detailed discussion.

When a developer offers elements for a transition, there are two modes they can choose from:

### As a single image

The entire painting of the element is captured, including things which appear outside of its bounding box such as shadows and blurs, as a single CSS image.

https://user-images.githubusercontent.com/93594/141118353-d62d19a1-0964-4fa0-880f-bdde656ce899.mp4

The element is captured without the effects (such as opacity and filters) from parent elements. Effects on the element itself are baked into the image. However, the element is captured without transforms, as those transforms are reapplied later. The root is always captured as a single image, with the other transition elements removed (similar to how compositing works today).

Capturing an element in this way isn't a new concept to the platform, as [`element()`](<https://developer.mozilla.org/en-US/docs/Web/CSS/element()>) in CSS performs a similar action. The differences are documented later.

Capturing as a CSS image avoids the interactivity risks, complexities, and memory impact of fully preserving these parts of Page-A as live DOM. On the other hand, it means that the capture will be 'static'. If it includes things like gifs, video, or other animating content, they'll be frozen on the frame they were displaying when captured.

#### Image Size
The size of the image cached for an element is equal to the element's [ink overflow rectangle](https://drafts.csswg.org/css-overflow-3/#ink-overflow-rectangle). This allows exposing parts of an element during the transition which may have been hidden earlier. The user-agent is allowed to clip the image to an implementation defined size (a common case would be the max texture size supported by the device). When caching a subset of the element due to this constraint, the area within the element cached by the user-agent is the area closest to the viewport.

The size of the root image and the area captured follows a pattern similar to shared elements. However, since the root image is generated using the root stacking context it is likely to be clipped to an implementation defined size in most cases.

An alternate choice was to clip the element to viewport bounds to limit memory use, particularly for the root element. This can be added as a perfomance hint from the developer in future iterations. See issues [72](https://github.com/WICG/shared-element-transitions/issues/72) and [73](https://github.com/WICG/shared-element-transitions/issues/73) for detailed discussion on this topic.

The single image mode works great for the share button and the root, as their transitions can be represented by simple transforms. However, the header changes size without stretching its shadow, and the content of the header moves independently and doesn't stretch. There's another mode for that:

### As the element's computed style + content image

In this mode the computed styles of the element are copied over, so they can be re-rendered beyond just transforming an image.

The children of the element (including pseudos and text nodes) are captured into a single CSS image that can be animated independently.

This allows the developer to animate [animatable CSS properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animated_properties) on the container such as border, background-color, border-radius, opacity. These properties roughly map to the element's box decorations and visual effects. The developer isn't prevented from animating properties like `font-size` but, since the children are captured as an image, changing the `font-size` won't change the visual output.

https://user-images.githubusercontent.com/93594/141118395-8d65da49-a5ab-41c6-8458-917e55d4b77b.mp4

A mode like this is unnecessary complexity for the share button in the example transition, but allows creating richer effects for the header transition.

The second mode where styles are copied to a container element won't be part of 'v1' of this feature.

### Nested transition elements

In the example transition, the content of the header cross-fades from Page-A to Page-B. An even smoother transition could be achieved by also animating the site title and avatar 'chip' independently. To allow for this, an offered element can contain other offered elements.

When an element is captured, its painting is 'lifted' from the parent offered element, which may be the root. This is similar to how browsers handle composited elements.

### Retaining hierarchy during a transition

By default, offered elements are captured in a flat hierarchy. As in all offered elements, including the root, will be laid out as siblings. The browser uses cached transforms to position each element so it overlaps exactly with its quad on the old page.

The means that, during the transition, scaling one offered element won't impact the rendering of another offered element, even if it was a child of the other element in the old page.

This mode allows elements to visually move between containers in viewport space, even if they were clipped to some parent in old page.

Alternatively, the developer can make an offered element a 'transition container'. Offered elements will be nested within their closest transition container, and the cached transform will position the element within that container rather than the viewport. This is similar in spirit to how `position: relative` becomes the containing block for absolutely positioned elements.

If 'transition containers' are used in combination with "element's computed style + content image", then effects on the parent such as `opacity`, `filter`, `mix-blend-mode` will also carry through to the children. Whereas in the flattened model, and "single image" model, effects on the parent no longer apply to the children.

'Transition containers' are out of scope for 'v1' of the feature. See [issue](https://github.com/WICG/shared-element-transitions/issues/74) for detailed discussion.

## Part 2: The preparation

At this point the state has changed over to Page-B, and Page-A is gone aside from the elements it offered. In the MPA case, this happens when the navigation is complete. In the SPA case, this happens when the DOM is in the Page-B state and the developer signals that the change is complete (how to make that signal is discussed later in the API).

### Setting the stage

The captured elements are displayed using a tree of pseudo-elements. The root of this tree is a viewport-filling container with fixed position. The offered elements from Page-A are positioned absolutely at (0,0), nested according to their closest 'transition container' or the root if there's no parent container, and moved into their previous viewport-relative (or transition container relative) positions using the cached transform. Their content is painted on top of Page-B which ensures that the user continues to see Page-A's visuals as Page-B is loading. Note that this may not reproduce the exact rendering on Page-A. For example, the relative paint order of shared elements is preserved in this tree rendered on top of Page-B. But if a shared element was occluded by another element, the latter is painted into the root's image unless it is also offered as a shared element.

Page-B is hidden from rendering until the transition is complete.

### How are transition elements represented?

The CSS images and computed properties/styles cached from Page-A are represented as elements with the following nesting:

```
transition root
├─ transition element
│  ├─ image wrapper
│  │  └─ image
│  └─ …child transition elements…
└─ …other transition elements…
```

- **transition root**: The fixed position container which is the root of the pseudo element tree. This element has a width/height of the viewport.
- **transition element**: If the element is created as a "computed style + content image", this element will have a width and height of the content box of the original element, and have its computed styles reapplied. If the part is created as a "single image", this element will have a width and height of the border box of the original element. In either case, this element is absolutely positioned at 0, 0 and has a transform applied to position it in viewport space.
- **image wrapper**: This element is absolutely positioned with an `inset` of 0, and has [`isolation: isolate`](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation). This wrapper is useful when cross-fading images (documented later).
- **image**: This contains the cached image, which may paint outside the parent elements. This would be a replaced element so CSS properties like `object-fit` will be supported. This element is absolutely positioned at 0, 0 and has a width and height of 100%, although the image may paint outside of its own bounds, similar to how a `box-shadow` is painted outside of an element's bounds.
- **child transition elements**: If this transition element is a 'transition container', child transition elements will be nested here.

These elements will be accessible to the developer via pseudo-elements.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/75): How does the UA apply styles to these elements? Particularly styles which are specific to one transition element, such as its transform. Inline styles are simple, but tricky for a developer to override in a stylesheet. An alternative would be to generate a `<style>` and put it, and the transition elements, in a shadow root along with the transition elements.

### Mixing in elements from Page-B and associating them with transition elements from Page-A

At this stage, Page-B identifies elements on its own page to be involved in the transition. This happens in the same way as the offering phase with one difference: The images and styles from Page-B will be updated if the underlying page updates. This means things like animated gifs will play, rather than being frozen on whatever frame they were on when they were captured.

The developer can associate particular elements from Page-A to elements from Page-B. This would usually be done if they're equivalent. In this case, the headers, share buttons, and roots are equivalent. When this happens, the image from the Page-B element is added to the same image wrapper:

```
transition element
├─ image wrapper
│  ├─ image (Page-A)
│  └─ image (Page-B)
└─ …child transition elements…
```

This allows for the container to be moved as one, while cross-fading the Page-A and Page-B content. The developer will also have access to the state of shared elements (from Page-A and Page-B) replicated on the container. This state depends on the capture mode (single image vs computed styles + content image).

Transition elements don't need to be associated with another transition elements, which allows for transitions involving elements that are only in Page-A or only in Page-B.

The root elements of each page are automatically associated.

Note that the order in which the transition elements are painted can be configured by UA and/or developer stylesheets using z-index.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/23): How should the default UA animation order these elements? And also handle a change in associated elements between the 2 pages.

### How are transition elements painted?

During the transition a new stacking context (called uber-root) is created with the following hierarchy :

```
uber-root stacking context
├─ root stacking context
└─ transition stacking context
```

This allows using the output of the root stacking context to provide a live root image for Page-B. The transition stacking context maps to the transition-root element. An alternate approach to this was to paint the transition-root in the [top layer](https://fullscreen.spec.whatwg.org/#top-layer). But that made it difficult to support transitions when there is other content in the top layer (fullscreen elements, dialog) and to ensure effects on the root element which are applied to the root stacking context (background-color, filter) are captured in the root image. See [issue](https://github.com/WICG/shared-element-transitions/issues/74) for detailed discussion.

## Part 3: The transition

Everything is now in place to perform the transition. The developer can animate the transition elements created by the UA using the usual APIs, such as CSS and web animations.

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

## Part 4: The end

When the transition is complete, the transition elements created by the UA are removed, revealing the real Page-B.

# The MPA API

There are a lot of open questions around the API, but this section will give a flavor of the direction.

Little thought has been giving to naming in these APIs, which will be improved when there's stronger consensus around the concepts.

## Creating a transition element

### CSS properties

```css
.header {
  page-transition-tag: header;
  page-transition-capture: container-and-child;
}
```

Setting a `page-transition-tag` marks this element as a transition element, and the `page-transition-capture` property is used to indicate how it's captured (as a single image vs as a computed style + content image).

Multiple elements could have the same `page-transition-tag` value, which is useful for aggregate content such as user comments.

Elements on Page-A and Page-B which have the same `page-transition-tag` are automatically associated with each other. If multiple elements have the same value, they're associated in DOM order.

Using CSS properties means values can change depending on viewport (`@media`) and browser support (`@supports`).

### JS API

```js
// In Page-A
addEventListener('navigate', (event) => {
  event.prepareSameOriginPageTransition((transition) => {
    transition.offerElement('header', document.querySelector('.header'), {
      capture: 'container-and-child',
    });

    transition.setData({…});
  });
});
```

Expanding on the capabilities of the CSS properties, a JS API allows the developer to change which parts are offered depending on the destination of the navigation, and the direction of navigation (back vs forward). This builds on top of the [app-history API](https://github.com/WICG/app-history).

Also, data can be provided via `setData`. This can be anything structured-clonable, and will be made available to Page-B.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/77): Is this a tight-coupling with app-history, or could it be usable without it?
- [Open question](https://github.com/WICG/shared-element-transitions/issues/78): Do we need `offerElement`? The same thing could be done by adding the CSS properties.

```js
// In Page-B
document.performTransition((transition) => {
  console.log(transition.data);
  const pageAHeader = transition.offeredElements.get('header');
  const pageBHeader = transition.createTransitionElement(document.querySelector('.header'), {
    capture: 'container-and-child',
  });
  transition.matchElements(pageAHeader, pageBHeader);
});
```

This sketch is particularly half-baked. A more concrete proposal will be possible when more of the concepts are decided.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/79): Do we need `createTransitionElement`? It could be done via adding CSS properties, but it might be clumsy if the developer is going to immediately remove the properties afterwards.
- [Open question](https://github.com/WICG/shared-element-transitions/issues/80): How does the outgoing page offer just the root for transition?
- [Open question](https://github.com/WICG/shared-element-transitions/issues/81): When is the `performTransition` callback called?

## Defining the animation

How will Page-B define the animation?

### Default animation

The potential default animations setup for the different cases are as follows. Note all of these can be overridden by the developer:

- If an element exists in Page-A only (exit animation), a fade animation takes its container from opacity 1 to 0.
- If an element exists in Page-B only (entry animation), a fade animation takes its container from opacity 0 to 1.
- If an element exists in both Page-A and Page-B, and both are 'container and content', an animation takes the container from Page-A styles to Page-B styles (which will include the transform used for positioning), while cross-fading the two images.
- If an element exists in both Page-A and Page-B, and neither are 'container and child', a transform animation takes its container from Page-A size/transform to Page-B size/transform, while cross-fading the two images.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/82): What if the Page-A element is 'container and child' but the Page-B element is 'single image'?

Because the images are sized to 100% of the container, the images will also change size throughout the transition. How these are scaled can be changed using regular CSS features like `object-fit`.

In all cases, the duration and easing is some undecided default, that could even be platform independent.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/83): When will the default animation start? When the browser would usually first render Page-B?
- [Open question](https://github.com/WICG/shared-element-transitions/issues/84): Default animations work well for things which are at least partially in-viewport in both Page-A and Page-B, but it gets tricky if you consider a non-sticky header that scrolled out of view by 1000s of pixels.
- [Open question](https://github.com/WICG/shared-element-transitions/issues/85): If the developer wants a default animation of the root only, how do they define that?

### CSS animation

CSS can be used to build on default animations, or override the default.

```css
::page-transition-container(header) {
  /* … */
}
```

Element selectors:

- `::page-transition-container(name)` - Select the transition containers of a given `page-transition-tag`.
- `::page-transition-image-wrapper(page-transition-tag)` - Select the transition parts of a given `page-transition-tag`.
- `::page-transition-outgoing-image(page-transition-tag)` - Select the outgoing image of a given `page-transition-tag`.
- `::page-transition-incoming-image(page-transition-tag)` - Select the incoming image of a given `page-transition-tag`.
- `::page-transition-root-outgoing` - Select the outgoing root image.
- `::page-transition-root-incoming` - Select the incoming root image.
- `::page-transition-root-container` - Useful for cases where something needs to be rendered underneath the root images.

These will be selecting UA generated pseudo-elements.

```css
::page-transition-container(header) {
  animation-delay: 300ms;
}
```

CSS can be used to make changes to the default animation, or override `animation-name` to remove the default.

### JavaScript access to elements

So far the transition elements have been addressed by pseudo-element selectors, but JavaScript could be given access to the elements using the [CSSPseudoElement](https://drafts.csswg.org/css-pseudo-4/#CSSPseudoElement-interface) interface.

```js
// In Page-B
document.performTransition((transition) => {
  // Build up transition parts, then…
  document.documentElement.pseudo("page-transition-container(name)").animate(...);
});
```

- [Open question](https://github.com/WICG/shared-element-transitions/issues/86) What's the deadline for calling `performTransition`?

Note that using pseudo-elements here implies that the developer can not change the DOM structure of transition elements. An alternate approach considered to provide this extensibility uses shadow DOM. The pseudo-element option was preferred to make it easier to build on concepts which already exist in the platform and ensure ease of implementation. See [issue](https://github.com/WICG/shared-element-transitions/issues/93) for detailed discussion.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/87): Is the freedom above a feature or a bug?

## Signaling the end of a page transition

At the start of the transition, the browser could gather all the `Animation`s active on the stage, and assume the animation is complete once all animations finish.

In addition, the JS API could include a way to override this by letting the developer provide a promise which keeps the transition active, allowing for animations driven some other way, such as `requestAnimationFrame`.

This is discussed in [#64](https://github.com/WICG/shared-element-transitions/issues/64).

## Example

Using the sketches above, here's how the example Page-A to Page-B transition could be done:

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

In Page-A:

```css
.header {
  page-transition-tag: header;
  page-transition-capture: container-and-child;
}

.share-button {
  page-transition-tag: share-button;
}
```

In Page-B:

```css
.header {
  page-transition-tag: header;
  page-transition-capture: container-and-child;
}

.share-button {
  page-transition-tag: share-button;
}

/* Slide the roots from right to left */
@keyframes slide-left {
  to { transform: translateX(-100%); }
}

::page-transition-root-outgoing {
  animation-name: slide-left;
}

::page-transition-root-incoming {
  left: 100%;
  animation-name: slide-left;
}

/* Prevent the header content from stretching */
::page-transition-image-outgoing(share-button),
::page-transition-image-incoming(share-button) {
  object-fit: cover;
}
```

# Single-Page-App API

The mechanism for cross-document transitions and SPA transitions involves the same phases, so an SPA API will expose those parts in the same page.

Half-baked sketch:

```js
document.documentTransition.prepare(async (transition) => {
  // …Identify State-A elements to capture, then:
  await updatePageStateSomehow();
  // The page is now in State-B.
  // …Identify State-B elements to capture, then:
  transition.start();
});
```

# Cross-fading

Cross-fading two DOM elements is currently impossible if both layers feature transparency. This is due to the default composition operation: black with 50% opacity layered over black with 50% opacity becomes black with 75% opacity.

However, the [plus-lighter](https://drafts.fxtf.org/compositing/#porterduffcompositingoperators_plus_lighter) compositing operation does the right thing when isolated to a set of elements whose `opacity` values add to 1. The "image wrapper" is meant to provide this isolation.

Allowing `mix-blend-mode` to be set to `plus-lighter` will enable developers to create real cross-fades between elements for this feature and elsewhere.

# Relation to `element()`

CSS has an [`element()`](https://drafts.csswg.org/css-images-4/#element-notation) feature which allows the appearance of an element to be used as an image.

This doesn't quite match either of the cases where we need to capture an element as an image.

When capturing 'as a single image', it seems much easier for developers if we expand the capture to include things outside the border box, such as box shadows. `element()` clips at the border box.

When capturing as a 'computed style + content image', we capture the combination of the element's children as image, clipped to the content box. Again this is different to `element()`.

However, these variations could be included in `element()` using modifiers or similarly named functions (e.g. `element-children()`). [Here](https://jsbin.com/bisoleziyi/edit?html,output) is a polyfill example of a single image mode transition built using the existing element() support in Firefox.

# Security/Privacy Considerations

The security considerations below cover same-origin transitions.

* Script can never read pixel content in the images. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
* If an element is captured as a 'computed style + content image', any external resources specified on the container, such as background images, will be re-fetched in the context of the new page to account for differences in sandboxing.

Cross-origin transitions aren't yet defined, but are likely to be heavily restricted.

# Interactivity and accessibility

Page transitions are a purely visual affordance. In terms of interactivity, transition elements will behave like `div`s regardless of the original element.

Developers could break this intent by adding interactivity directly to the transition element, e.g. by deliberately adding a `tabindex` attribute. But this isn't recommended.

The page transition stage will be hidden from assistive technologies such as screen readers.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/88): Should hit-testing ignore transition elements?
