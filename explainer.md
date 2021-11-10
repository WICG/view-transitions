# Introduction

https://user-images.githubusercontent.com/93594/140955654-fa944c4d-530e-4d3c-8286-50864d59bb0d.mp4

When a user navigates on the web, state tends to abruptly switch from Page-A to Page-B. This can include a flash of white, and elements which seem to disappear only to reappear in the same place. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. In addition, it increases the user's perception of loading time as compared with a smooth loading animation. For these reasons, most platforms provide easy-to-use primitives that enable developers to build seamless transitions: [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

Shared Element Transitions provides developers with the same capability on the web, irrespective of whether the transitions are cross-document or intra-document (SPA).

# Use-Cases

A visual demo of some example transition patterns targeted by this feature are [here](https://material.io/design/motion/the-motion-system.html#transition-patterns). The following is a summary of the semantics of these transition patterns:

* Root Transitions: The full page content animates between two web pages with an optional static UI element on top. Examples 1 & 2 [here](https://material.io/design/motion/the-motion-system.html#shared-axis) are demonstrations of this.
* Shared Element to Root Transitions: A persistent UI element morphs into the full page content on the next web page. [Container transform](https://material.io/design/motion/the-motion-system.html#container-transform) shows an example.
* Shared Element Transitions: A persistent UI element morphs into another UI element on the next web page. The element's contents and shape can change during this transition. This [video](https://www.youtube.com/watch?v=SGnZN3NE0jA) shows an example.
* Entry/Exit Transitions: A UI element animates as it exits or enters the screen. This [issue](https://github.com/WICG/shared-element-transitions/issues/37) shows an example.

# Design

The goal is to provide a mechanism and API which will allow simple transitions like above to be specified in CSS, building on CSS animations, but also allow for more complex transition to be performed via JavaScript, building on the Web Animations API.

This section covers the concepts and mechanisms, while a later section looks at possible API shapes.

Performing a transition from Page-A to Page-B requires parts of both to be on screen at the same time, potentially moving independently. This is currently impossible in a cross-document navigation, but it's still hard in an SPA (single page app) navigation. You need to make sure that the outgoing state can't receive additional interactions, and ensure the presence of both states doesn't create a confusing experience for those using accessibility technology.

The aim of this design is to allow for representations of both Page-A and Page-B to exist at the same time, without the usability, accessibility, or memory concerns of having both complete DOM trees alive.

Here's the example that will be used to explain the design:

<img alt="Page-A and Page-B" src="media/pages.png?raw=true">

The transition between Page-A and Page-B can be a full cross-document navigation between two same-origin pages, or it can be an SPA navigation. The main mechanism and concepts are the same between the two.

Cross-origin transitions are something we want to tackle, but may have significant differences and restrictions for security reasons. Cross-origin transitions are not covered in this document.

## Part 1: The offering

Before Page-A goes away, it offers up parts of itself to be used in the transition. Generally, this will mean one part per 'thing' that acts independently during the transition. For the example transition, the parts are:

- The header
- The share button
- The rest (referred to as the page root)

https://user-images.githubusercontent.com/93594/141104275-6d1fb67a-2f73-41e4-9cef-14676798223b.mp4

Aside from the root, an element can only be offered as a transition part if it has paint containment, which clips child content to the content box, although this can be expanded with `overflow-clip-margin`. The is a compromise made to greatly simplify implementation.

Additionally, the element must be a single rect. As in, it doesn't break across lines or columns.

- Open question: If the developer tries to break the above rules, what should happen? Is paint containment applied by the browser? Is that element dropped from the transition? Is the whole transition abandoned?

When a developer offers part of the page for transitions, there are two modes they can choose from:

### As a single texture

The entire painting of the element is captured, including things which appear outside of its bounding box such as shadows and blurs, as a single texture at device-pixel resolution.

https://user-images.githubusercontent.com/93594/141118353-d62d19a1-0964-4fa0-880f-bdde656ce899.mp4

- Open question: Which effects from a parent element are baked into this texture? E.g. things like `filter`, `opacity`, `transform`.

Capturing as a texture avoids the interactivity risks, complexities, and memory impact of fully preserving these parts of Page-A as live DOM.

The root is always captured in this way, and is also clipped to the viewport, as capturing the entire page would take an enormous amount of memory in some cases.

- Open question: Should we have a way to expand this area for particular transitions? For example, transitions that involve vertical movement?
- Open question: Other elements can also be massive. Do we need a way to limit and control the captured size of those?

This mode works great for the share button and the root, as their transitions can be represented by simple transforms. However, the header changes size without stretching its shadow, and the content of the header moves independently. There's another mode for that:

### As a container + child texture

In this mode the computed styles of the element are copied over, so they can be re-rendered beyond just transforming a texture. This allows the developer to animate properties such as width and height, borders, background color… anything that can be animated with CSS. It also allows the developer to create animations that clip child content, via `overflow: hidden`.

The children of the element (including pseudos and text nodes) are captured into a single texture that can be animated independently.

https://user-images.githubusercontent.com/93594/141118395-8d65da49-a5ab-41c6-8458-917e55d4b77b.mp4

A mode like this is unnecessary complexity for the share button in the example transition, but gives the developer the freedom they need for the header transition.

- Open question: Do we need this for 'v1'?

### Nested parts

In the example transition, the content of the header cross-fades from Page-A to Page-B. An even smoother transition could be achieved by also animating the site title and avatar 'chip' independently. However, to reduce the scope of 'v1', offering parts nested in other offered parts is not allowed.

- Open question: If the developer tries to do this, what should happen? Is the nested offering ignored? Is the whole transition abandoned?

## Part 2: The preparation

The state changes over to Page-B, and Page-A is gone aside from the parts it offered.

### Setting the stage

A fixed-position, viewport-filling overlay is automatically created in the top level.

The offered parts from Page-A are absolutely positioned at (0,0), and moved into their previous viewport-relative positions using a transform.

This is done without the user seeing Page-B. Ideally, there won't be a visual change from the final rendering of Page-A. However, the non-root parts will always render on top of the root, whereas the original page may have drawn other things on top of the offered parts.

### How are these parts represented?

Transition parts are represented as elements with the following nesting:

```
transition part container
└─ transition part
   └─ texture
```

- **transition part container**: If the part is created as a "container + child texture", this element will have a width and height of the content area of the original element, and have its computed styles reapplied. If the part is created as a "single texture", this element will have a width and height of the border box of the original element.
- **transition part**: This element has a width and height of 100%, and `isolation: isolate`. This wrapper is useful when cross-fading textures (documented later).
- **texture**: This contains the texture, which may paint outside the parent elements. This would behave like a replaced element, so would work with CSS properties like `object-fit`.
  - Open question: How is painting outside handled? This element could overflow the parents in a developer-visible way, or we could avoid exposing that part somehow (as we currently do with paint overflowing).

- Open question: What are these elements? Pseudo-elements are tricky to handle in some APIs (e.g., no `getBoundingClientRect` equivalent), and the nesting of pseudo-elements seems new. Alternatively, they could be `div`s in a shadow root, which means developers can use regular APIs on these elements.
- Open question: How are styles applied to these elements? Inline styles are simple, but tricky to override in a stylesheet. An alternative would be to generate a `<style>` and put it, and the transition elements, in a shadow root.

### Mixing in parts of Page-B and associating them with Page-A parts

At this stage, Page-B identifies parts of its own page to be involved in the transition. This happens in the same way as part 1 with one difference: The textures and styles from Page-B will be updated if the underlying page updates. This means things like animated gifs will play, rather than being frozen on whatever frame they were on when they were captured.

The developer can associate particular parts from Page-A to parts from Page-B. This would usually be done if they're equivalent. In this case, the headers, share buttons, and roots are equivalent. When this happens, the texture from the Page-B capture is added to the transition part:

```
transition part container
└─ transition part
   ├─ texture (Page-A)
   └─ texture (Page-B)
```

This allows for the container to be moved as one, while cross-fading the Page-A and Page-B content. The developer will also have access to both computed styles of the container for both Page-A and Page-B, so those can also be transitioned.

Parts don't need to be associated with another part, which allows for transitions involving elements that are only in Page-A or only in Page-B.

The root parts of each page are automatically associated.

## Part 3: The transition

Everything is now in place to perform the transition. The developer can move the parts around using the usual APIs, such as CSS and web animations.

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

## Part 4: The end

When the transition is complete, the top level is removed, revealing the real Page-B.

# The API

There are a lot of open questions around the API, but this section will give a flavour of the direction.

Little thought has been giving to naming in these APIs, which will be improved when it's clearer what the right direction is.

Additionally, this API focused on cross-document transitions.

## Creating a transition part

There are a few ideas for how a developer could offer an element as a transition part.

### Attributes

```html
<header pagetransitiontag="header" pagetransitioncapture="container-and-child">…</header>
```

Here, the presence of the `pagetransitiontag` attribute marks this element as a transition part, and the `pagetransitioncapture` attribute is used to indicate how it's captured (as a single texture vs as a container + child texture).

Multiple elements could have the same `pagetransitiontag` value, which is useful for aggregate content such as comments.

Items on Page-A and Page-B which have the same `pagetransitiontag` are automatically associated with each other. If multiple items have the same value, they're associated in DOM order.

### CSS properties

```css
.header {
  page-transition-tag: header;
  page-transition-capture: container-and-child;
}
```

This operates similar to the attributes, but it's easier to give multiple elements the same tag. It's also easier to change values depending on viewport (`@media`) and browser support (`@supports`).

### JS API

```js
// In Page-A
addEventListener('navigate', (event) => {
  event.prepareSameOriginPageTransition((transition) => {
    transition.offerItem('header', document.querySelector('.header'), {
      data: {…},
      capture: 'container-and-child',
    });
  });
});
```

Expanding on the capabilities of the CSS properties, a JS API allows the developer to change which parts are offered depending on the destination of the navigation, and the direction of navigation (back vs forward). This builds on top of the [app-history API](https://github.com/WICG/app-history).

Also, `data` can be associated with the element. This can be anything structured-clonable, and will be made available to Page-B.

```js
// In Page-B
document.performTransition((transition) => {
  const pageAHeader = transition.offeredItems.get('header');
  console.log(pageAHeader.data);
  const pageBHeader = transition.createItem(document.querySelector('.header'), {
    capture: 'container-and-child',
  });
  transition.matchItems(pageAHeader, pageBHeader);
});
```

This sketch is particularly half-baked. A more concrete proposal will be possible when more of the concepts are decided.

We probably shouldn't have both an attribute and CSS property based API, but a JS API could live alongside either of those for more advanced usage.

## Defining the animation

How will Page-B define the animation?

### Automatic animation

If an item exists in Page-A only, it could have a default animation that takes its container from opacity 1 to 0.

If an item exists in Page-B only, it could have a default animation that takes its container from opacity 0 to 1.

If an item exists in both Page-A and Page-B, and both are 'container and child', it could have a default animation that takes its container from Page-A styles to Page-B styles (which will include the transform used for positioning), while cross-fading the two textures.

If an item exists in both Page-A and Page-B, and neither are 'container and child', it could have a default animation that takes its container from Page-A size and position to Page-B styles via a transform, while cross-fading the two textures.

- Open question: What if the Page-A item is 'container and child' but the Page-B item is 'single texture'?

Because the textures are sized to 100% of the container, the textures will also change size throughout the transition. How these are scaled can be changed using regular CSS features like `object-fit`.

In all cases, the duration and easing is some undecided default, that could even be platform independent.

- Open question: When will the automatic animation start? When the browser would usually first render Page-B?
- Open question: Automatic animations work well for things which are at least partially in-viewport in both Page-A and Page-B, but it gets tricky if you consider a non-sticky header that scrolled out of view by 1000s of pixels.

### CSS animation

CSS can be used to build on automatic animations, or override the default.

```css
::page-transition-container(header) {
  /* … */
}
```

Element selectors:

- `::page-transition-container(name)` - Select the transition part containers of a given `page-transition-tag`.
- `::page-transition-part(name)` - Select the transition parts of a given `page-transition-tag`.
- `::page-transition-texture-outgoing(name)` - Select the outgoing texture of a given `page-transition-tag`.
- `::page-transition-texture-incoming(name)` - Select the incoming texture of a given `page-transition-tag`.
- `::page-transition-root-outgoing` - Select the outgoing root texture.
- `::page-transition-root-incoming` - Select the incoming root texture.
- `::page-transition-background` - This can be set for cases where something needs to be rendered underneath the root textures.

These will be selecting a pseudo-element, or an element in a UA-created shadow DOM.

```css
::page-transition-container(header) {
  animation-delay: 300ms;
}
```

CSS can be used to make changes to the automatic animation, or override `animation-name` to remove the default.

### Web animation API

```js
// In Page-B
document.performTransition((transition) => {
  // Build up transition parts, then…
  transition.root.querySelector('[part=header]').animate(…);
});
```

- Open question: What's the deadline for calling `performTransition`?

Again, this is a half-baked sketch. This example assumes that elements in the shadow root are given a part attribute, but there's likely some better way to address the elements.

If the 'stage' of the transition is exposed as a shadow root, the developer can interact with the elements in a regular way. The developer could even create elements specifically for the transition.

## Signaling the end of a page transition

At the start of the transition, the browser could gather all the `Animation`s active on the stage, and assume the animation is complete once all animations finish.

In addition, the JS API could include a way to provide a promise which keeps the transition active, allowing for animations driven some other way, such as `requestAnimationFrame`.

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
::page-transition-texture-outgoing(share-button),
::page-transition-texture-incoming(share-button) {
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

However, the [plus-lighter](https://drafts.fxtf.org/compositing/#porterduffcompositingoperators_plus_lighter) compositing operation does the right thing when isolated to a set of elements whose `opacity` values add to 1. The "transition part" wrapper performs this isolation.

Allowing `mix-blend-mode` to be set to `plus-lighter` will enable developers to create real cross-fades between elements for this feature and elsewhere.

# Relation to `element()`

CSS has an [`element()`](https://drafts.csswg.org/css-images-4/#element-notation) feature which allows the appearance of an element to be used as an image.

This doesn't quite match either of the cases where we need to capture an element as a texture.

When capturing 'as a single texture', it seems much easier for developers if we expand the capture to include things outside the border box, such as box shadows. `element()` clips at the border box.

When capturing 'as a container + child texture', we capture the combination of the element's children as texture, clipped to the content box. Again this is different to `element()`.

However, these variations could be included in `element()` using modifiers or similarly named functions (e.g. `element-children()`).

# Security/Privacy Considerations

The security considerations below cover same-origin transitions.

* Script can never read pixel content in the textures. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
* If an element is captured 'as a container + child texture', any external resources specified on the container, such as background images, will be re-fetched in the context of the new page to account for differences in sandboxing.

Cross-origin transitions aren't yet defined, but are likely to be heavily restricted.

# Interactivity and accessibility

Page transitions are a purely visual affordance. In terms of interactivity, transition elements will behave like `div`s regardless of the original element.

Developers could break this intent by adding interactivity directly to the transition element, e.g. by deliberately adding a `tabindex` attribute. But this isn't recommended.

The page transition stage will be hidden from assistive technologies such as screen readers.
