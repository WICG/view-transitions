# Introduction

https://user-images.githubusercontent.com/93594/140955654-fa944c4d-530e-4d3c-8286-50864d59bb0d.mp4

When a user navigates on the web from Page-A to Page-B, the viewport jumps and
there is a flash of white as elements disappear only to reappear in the same
place in some in-progress state. This sequenced, disconnected user experience is
disorienting and results in a higher-cognitive load as the user is forced to
piece together how they got to where they came from. Additionally, this jarring
experience increases how much users perceive the page loading as they stare at
the white limbo state.

Smooth loading animations can lower the cognitive load by helping users [stay in
context](https://www.smashingmagazine.com/2013/10/smart-transitions-in-user-experience-design/)
as they navigate from Page-A to Page-B, and [reduce the perceived
latency](https://wp-rocket.me/blog/perceived-performance-need-optimize/#:~:text=1.%20Use%20activity%20and%20progress%20indicators) of
loading by providing them with something engaging and delightful in the
meantime. For these reasons, most platforms provide easy-to-use primitives that
enable developers to build seamless transitions:
[Android](https://developer.android.com/training/transitions/start-activity),
[iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle)
and
[Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

Shared Element Transitions provides developers with the same capability on the
web, irrespective of whether the transitions are cross-document (MPA) or
intra-document (SPA).

# Use-Cases

A visual demo of some example transition patterns targeted by this feature is
[here](https://material.io/design/motion/the-motion-system.html#transition-patterns).
The following is a summary of the semantics of these transition patterns:

- Root Transitions: The full page content animates between two web pages with an
  optional static UI element on top. Examples 1 & 2
  [here](https://material.io/design/motion/the-motion-system.html#shared-axis)
  are demonstrations of this.
- Shared Element to Root Transitions: A persistent UI element morphs into the
  full page content on the next web page. [Container
  transform](https://material.io/design/motion/the-motion-system.html#container-transform)
  shows an example.
- Shared Element Transitions: A persistent UI element morphs into another UI
  element on the next web page. The element's contents and shape can change
  during this transition. This
  [video](https://www.youtube.com/watch?v=SGnZN3NE0jA) shows an example.
- Entry/Exit Transitions: A UI element animates as it exits or enters the
  screen. This
  [issue](https://github.com/WICG/shared-element-transitions/issues/37) shows an
  example.

# Design

The goal is to provide a mechanism and API which will allow simple transitions
like above to be specified in CSS, building on CSS animations, but also allow
for more complex transitions to be performed via JavaScript, building on the Web
Animations API.

This section covers the concepts and mechanisms, while a later section looks at
possible API shapes.

Performing a transition from Page-A to Page-B requires parts of both to be on
screen at the same time, potentially moving independently. This is currently
impossible in a cross-document navigation, but it's still hard in an SPA (single
page app) navigation. You need to make sure that the outgoing state persists
along with the incoming state, that it can't receive additional interactions,
and ensure the presence of both states doesn't create a confusing experience for
those using accessibility technology.

The aim of this design is to allow for representations of both Page-A and Page-B
to exist at the same time, without the usability, accessibility, performance,
security and memory concerns of having both complete DOM trees alive.

Here's the example that will be used to explain the design:

<img alt="Page-A and Page-B" src="media/pages.png?raw=true">

The concepts and process described in this section apply for both MPA and SPA
transition, however the API will differ in parts.

Cross-origin transitions are something we want to tackle, but may have
significant differences and restrictions for security reasons. Cross-origin
transitions are not covered in this document.

## Part 1: The offering

Before Page-A goes away, it offers up elements to be used in the transition.
Generally, this will mean an element that animates independently during the
transition. For the example transition, the elements are:

- The header
- The share button
- The rest (referred to as the page root)

https://user-images.githubusercontent.com/93594/141104275-6d1fb67a-2f73-41e4-9cef-14676798223b.mp4

An element offered for a transition has the following restrictions:

- [`contain: paint`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)
  which ensures that the element is the containing block for all positioned
  descendants and generates a stacking context. This implies that the child
  content will be clipped to the context-box but it can be expanded using
  ['overflow-clip-margin'](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-clip-margin).
  Being a stacking context and a containing block allows the element to be
  treated as a single unit, whereas paint containment simplifies implementation.
- [`break-inside:
  avoid`](https://developer.mozilla.org/en-US/docs/Web/CSS/break-inside) which
  disallows fragmentation ensuring the element content is a single rect, i.e.,
  it doesn't break across lines or columns, again allowing the element to be
  treated as a single unit.

These constraints are implicitly applied to the element's rendering by the UA.
See [issue](https://github.com/WICG/shared-element-transitions/issues/71) for
detailed discussion.

When a developer offers elements for a transition, there are two modes they can
choose from:

### As a single image

The painting of the element is captured, including things which appear outside
of its bounding box such as shadows and blurs, as a single CSS image.

https://user-images.githubusercontent.com/93594/141118353-d62d19a1-0964-4fa0-880f-bdde656ce899.mp4

The element is captured without the effects (such as opacity and filters) from
parent elements. Effects on the element itself are baked into the image.
However, the element is captured without transforms, as those transforms are
reapplied later. The root is always captured as a single image, with the other
transition elements removed (similar to how compositing works today).

Capturing an element in this way isn't a new concept to the platform, as
[`element()`](<https://developer.mozilla.org/en-US/docs/Web/CSS/element()>) in
CSS performs a similar action. The differences are documented later.

Capturing as a CSS image avoids the interactivity risks, complexities, and
memory impact of fully preserving these parts of Page-A as live DOM. On the
other hand, it means that the capture will be 'static'. If it includes things
like gifs, video, or other animating content, they'll be frozen on the frame
they were displaying when captured.

#### Image Size

The size of the image cached for an element is equal to the element's [ink
overflow
rectangle](https://drafts.csswg.org/css-overflow-3/#ink-overflow-rectangle).
This allows exposing parts of an element during the transition which may have
been hidden earlier. The user-agent is allowed to clip the image to an
implementation defined size (a common case would be the max texture size
supported by the device). When caching a subset of the element due to this
constraint, the area within the element cached by the user-agent is the area
closest to the viewport.

The size of the root image and the area captured follows a pattern similar to
shared elements. However, since the root image is generated using the root
stacking context it is likely to be clipped to an implementation defined size in
most cases.

An alternate choice was to clip the element to viewport bounds to limit memory
use, particularly for the root element. This can be added as a perfomance hint
from the developer in future iterations. See issues
[72](https://github.com/WICG/shared-element-transitions/issues/72) and
[73](https://github.com/WICG/shared-element-transitions/issues/73) for detailed
discussion on this topic.

The single image mode works great for the share button and the root, as their
transitions can be represented by simple transforms. However, the header changes
size without stretching its shadow, and the content of the header moves
independently and doesn't stretch. There's another mode for that:

### As the element's computed style + content image

In this mode the computed styles of the element are copied over, so they can be
re-rendered beyond just transforming an image.

The children of the element (including pseudos and text nodes) are captured into
a single CSS image that can be animated independently.

This allows the developer to animate [animatable CSS
properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animated_properties)
on the container such as border, background-color, border-radius, opacity. These
properties roughly map to the element's box decorations and visual effects. The
developer isn't prevented from animating properties like `font-size` but, since
the children are captured as an image, changing the `font-size` won't change the
visual output.

https://user-images.githubusercontent.com/93594/141118395-8d65da49-a5ab-41c6-8458-917e55d4b77b.mp4

A mode like this is unnecessary complexity for the share button in the example
transition, but allows creating richer effects for the header transition.

The second mode where styles are copied to a container element won't be part of
'v1' of this feature.

### Nested transition elements

In the example transition, the content of the header cross-fades from Page-A to
Page-B. An even smoother transition could be achieved by also animating the site
title and avatar 'chip' independently. To allow for this, an offered element can
contain other offered elements.

When an element is captured, its painting is 'lifted' from the parent offered
element, which may be the root. This is similar to how browsers handle
composited elements.

### Retaining hierarchy during a transition

By default, offered elements are captured in a flat hierarchy. As in all offered
elements, including the root, will be laid out as siblings. The browser uses
cached transforms to position each element so it overlaps exactly with its quad
on the old page.

The means that, during the transition, scaling one offered element won't impact
the rendering of another offered element, even if it was a child of the other
element in the old page.

This mode allows elements to visually move between containers in viewport space,
even if they were clipped to some parent in old page.

Alternatively, the developer can make an offered element a 'transition
container'. Offered elements will be nested within their closest transition
container, and the cached transform will position the element within that
container rather than the viewport. This is similar in spirit to how `position:
relative` becomes the containing block for absolutely positioned elements.

If 'transition containers' are used in combination with "element's computed
style + content image", then effects on the parent such as `opacity`, `filter`,
`mix-blend-mode` will also carry through to the children. Whereas in the
flattened model, and "single image" model, effects on the parent no longer apply
to the children.

'Transition containers' are out of scope for 'v1' of the feature. See
[issue](https://github.com/WICG/shared-element-transitions/issues/74) for
detailed discussion.

## Part 2: The preparation

At this point the state has changed over to Page-B, and Page-A is gone aside
from the elements it offered.

If Page-B is on a different origin to Page-A, the elements offered by Page-A are
discarded, and the rest of the process is aborted. Cross-origin transitions are
something we want to tackle, but they may have significant differences and
restrictions for security reasons. How they may work is not explored in this
version of this document.

In the MPA case, this happens when the navigation is complete. In the SPA case,
this happens when the DOM is in the Page-B state and the developer signals that
the change is complete (how to make that signal is discussed later in the API).

### Setting the stage

The captured elements are displayed using a tree of pseudo-elements. The root of
this tree is a viewport-filling container with fixed position. The offered
elements from Page-A are positioned absolutely at (0,0), nested according to
their closest 'transition container' or the root if there's no parent container,
and moved into their previous viewport-relative (or transition container
relative) positions using the cached transform. Their content is painted on top
of Page-B which ensures that the user continues to see Page-A's visuals as
Page-B is loading. Note that this may not reproduce the exact rendering on
Page-A. For example, the relative paint order of shared elements is preserved in
this tree rendered on top of Page-B. But if a shared element was occluded by
another element, the latter is painted into the root's image unless it is also
offered as a shared element.

Page-B is hidden from rendering until the transition is complete.

### How are transition elements represented?

The CSS images and computed properties/styles cached from Page-A are represented
as elements with the following nesting:

```
transition root
├─ transition element
│  ├─ image wrapper
│  │  └─ image
│  └─ …child transition elements…
└─ …other transition elements…
```

- **transition root**: The fixed position container which is the root of the
  pseudo element tree. This element has a width/height of the viewport.
- **transition element**: If the element is created as a "computed style +
  content image", this element will have a width and height of the content box
  of the original element, and have its computed styles reapplied. If the part
  is created as a "single image", this element will have a width and height of
  the border box of the original element. In either case, this element is
  absolutely positioned at 0, 0 and has a transform applied to position it in
  viewport space.
- **image wrapper**: This element is absolutely positioned with an `inset` of 0,
  and has [`isolation:
  isolate`](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation). This
  wrapper is useful when cross-fading images (documented later).
- **image**: This contains the cached image, which may paint outside the parent
  elements. This would be a replaced element so CSS properties like `object-fit`
  will be supported. This element is absolutely positioned at 0, 0 and has a
  width and height of 100%, although the image may paint outside of its own
  bounds, similar to how a `box-shadow` is painted outside of an element's
  bounds.
- **child transition elements**: If this transition element is a 'transition
  container', child transition elements will be nested here.

These elements will be accessible to the developer via pseudo-elements. The
default animations specified by the user agent are set up using a dynamic user
agent stylesheet. This allows developers to customize the transition by
overriding the default styles with developer provided CSS.

The pseudo-elements are generated at the offering phase for captured elements
from Page-A. At this point, only a single image element is generated for
snapshots from Page-A. Image elements for Page-B are generated later as
specified below. These pseudo-elements are exposed to developer CSS after
elements from Page-B have been added to the pseudo-element tree.

### Mixing in elements from Page-B and associating them with transition elements from Page-A

At this stage, Page-B identifies elements on its own page to be involved in the
transition. This happens in the same way as the offering phase with one
difference: The images and styles from Page-B will be updated if the underlying
page updates. This means things like animated gifs will play, rather than being
frozen on whatever frame they were on when they were captured.

The developer can associate particular elements from Page-A to elements from
Page-B. This would usually be done if they're equivalent. In this case, the
headers, share buttons, and roots are equivalent. When this happens, the image
from the Page-B element is added to the same image wrapper:

```
transition element
├─ image wrapper
│  ├─ image (Page-A)
│  └─ image (Page-B)
└─ …child transition elements…
```

This allows for the container to be moved as one, while cross-fading the Page-A
and Page-B content. The developer will also have access to the state of shared
elements (from Page-A and Page-B) replicated on the container. This state
depends on the capture mode (single image vs computed styles + content image).

Transition elements don't need to be associated with another transition
elements, which allows for transitions involving elements that are only in
Page-A or only in Page-B.

Note that the order in which the transition elements are painted can be
configured by UA and/or developer stylesheets using z-index.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/23):
  How should the default UA animation order these elements? And also handle a
  change in associated elements between the 2 pages.

### How are transition elements painted?

During the transition a new stacking context (called uber-root) is created with
the following hierarchy :

```
uber-root stacking context
├─ root stacking context
└─ transition stacking context
```

This allows using the output of the root stacking context to provide a live root
image for Page-B. The transition stacking context maps to the transition-root
element. An alternate approach to this was to paint the transition-root in the
[top layer](https://fullscreen.spec.whatwg.org/#top-layer). But that made it
difficult to support transitions when there is other content in the top layer
(fullscreen elements, dialog) and to ensure effects on the root element which
are applied to the root stacking context (background-color, filter) are captured
in the root image. See
[issue](https://github.com/WICG/shared-element-transitions/issues/74) for
detailed discussion.

## Part 3: The transition

Everything is now in place to perform the transition. The developer can animate
the transition elements created by the UA using the usual APIs, such as CSS and
web animations.

https://user-images.githubusercontent.com/93594/141100217-ba1fa157-cd79-4a9d-b3b4-67484d3c7dbf.mp4

Note that the browser defers displaying elements from Page-B and starting the
animation until Page-B is ready for first render. This is currently driven by
internal browser heuristics and is being standardized in the proposal
[here](https://github.com/whatwg/html/issues/7131).

## Part 4: The end

When the transition is complete, the transition elements created by the UA are
removed, revealing the real Page-B. The transition completes once no pseudo
element has an active animation.

# The cross-document transition API

## Page-A

Page-A must offer elements to use for a transition, otherwise no transition will
happen.

### Via CSS

Page-A can offer an element to be used in a transition via CSS, using the
`page-transition-tag` property:

```css
:root {
  page-transition-tag: root;
}
.header {
  page-transition-tag: header;
}
```

The tag is a
[`<custom-ident>`](https://www.w3.org/TR/css-values/#identifier-value). It's
recommended to use 'root' to refer to the bottommost element that covers the
viewport, which is usually `:root`, but this isn't enforced.

Page-A must offer elements to use for a transition, otherwise no transition will
happen.

A tag must be unique for a document. If multiple elements share a tag, the
transition will be abandoned. In future, multiple elements may be able to share
a tag, but it isn't yet clear how that would work.

The other modes mentioned in this document, such as "computed style + content
image", and "retaining hierarchy" will be exposed via other CSS properties, and
`page-transition` will be used as a shorthand. However, this is out of scope for
'v1'.

### Via JavaScript

The JavaScript API extends on the capabilities of the CSS API. In particular, it
allows the developer to react to the URL of Page-B.

```js
document.addEventListener("pagehide", (event) => {
  if (!event.transition) return;
  event.transition.setElement(document.documentElement, "root");
  event.transition.setData({ … });
});
```

[Issue](https://github.com/WICG/shared-element-transitions/issues/112):
`pagehide` may happen too late. We may need something like `beforepagehide`.

The
[`pagehide`](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)
event is an existing event which fires during the unload of a document. The
event type is currently
[`PageTransitionEvent`](https://html.spec.whatwg.org/multipage/indices.html#events-2:pagetransitionevent).
This proposal will change that to `PageHideTransitionEvent`, which extends
`PageTransitionEvent`, and adds the following:

- `event.nextURL` - The URL of the next page. Is `null` if cross-origin, or if
  there's no next page for this window (e.g. when closing the window).
- `event.transition` - `null` if a transition cannot be performed. The following
  needs to be true for transitions to be performed:
  - The browser supports page transitions.
  - This document is navigating to another (`pagehide` also fires if the
    iframe/tab is being removed).
  - The next page is same-origin, although cross-origin may be supported in
    future.
  - The window is top-level, although nested page transitions may be supported
    in future.
- `event.transition.setElement(element, tag, options)` - Set an element to be
  used in the transition.
  - `element` - the element.
  - `tag` - the tag name. Can be `null` to un-set this element. This is
    equivalent to `page-transition-tag`.
  - `options` - reserved for future use. This is where "computed style + content
    image" and "retaining hierarchy" modes will be exposed.
- `event.transition.setData(data)` - An object that is structured-cloned and
  passed to the next page.
- `event.transition.ignoreCSSTaggedElements()` - Ignore any use of
  `page-transition-tag` on this page for this transition.

Methods on `event.transition` must be called during the dispatch of the
`pagehide` event, otherwise an error is thrown.

Once `pagehide` has dispatched:

1. If `ignoreCSSTaggedElements` was not called, gather elements offered via
   `page-transition-tag`.
1. Add/remove offered elements according to `setElement` calls.
1. If multiple elements share the same tag, abandon the transition.
1. If at least one element remains offered, a transition can go ahead.

As a result of the above, if an element is offered via CSS and `setElement`,
then `setElement` wins. If there are multiple calls to `setElement` for the same
element, the last wins.

Gathering offered elements _after_ the dispatch of `pagehide` means the
developer can use a mix of the CSS and JS methods. For instance, the developer
could set a class on the root element depending on `event.nextUrl`, which
changes the offered elements.

## Page-B

Page-B must also offer elements to use for a transition to happen. Page-B also
controls the animation of the transition.

### Via CSS

#### Offering Page-B elements

Page-B elements are offered for the transition using the same mechanism as in
Page-A, `page-transition-tag`.

Elements from Page-A and Page-B that have the same tag are merged into one
transition elements as documented in "Mixing in elements from Page-B and
associating them with transition elements from Page-A".

#### Targeting transition elements

The pseudo-elements are constructed as documented in "how are transition
elements represented".

These pseudo-element selectors provide access to these pseudo-elements via
`:root`:

- `::page-transition` - The parent of all transition containers.
- `::page-transition-container(tag)` - Select the 'transition element' of a
  given `page-transition-tag`.
- `::page-transition-image-wrapper(tag)` - Select the 'image wrapper'.
- `::page-transition-incoming-image(tag)` - Select the incoming image.
- `::page-transition-outgoing-image(tag)` - Select the outgoing image.

Using '\*' instead of a tag selects the equivalent element for every tag.

#### Default styles

These styles will be in the UA stylesheet:

```css
::page-transition {
  position: fixed;
  inset: 0;
}

::page-transition-container(*) {
  position: absolute;
  top: 0;
  left: 0;
}

::page-transition-image-wrapper(*) {
  position: absolute;
  inset: 0;
  isolation: isolate;
}

::page-transition-incoming-image(*),
::page-transition-outgoing-image(*) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* This is a new proposed value. See 'cross-fading' */
  mix-blend-mode: lighter;
}
```

#### Animations

The default animations are as follows:

- `::page-transition-incoming-image` animates _from_ opacity 0.
- `::page-transition-outgoing-image` animates _to_ opacity 0.
- If an element exists in both Page-A and Page-B, a transform animation takes
  its container from Page-A size/transform to Page-B size/transform. Otherwise
  the element will remain in its final position.

All animations use a fill-mode of `both`.

The styles to apply these animations will be dynamically added to the UA
stylesheet, and removed once the transition is complete.

- Open question: What are the default durations and easings?
- Open question: Are the generated keyframes usable outside the UA stylesheet?
  If so, what are they called?
- [Open question](https://github.com/WICG/shared-element-transitions/issues/84):
  Default animations work well for things which are at least partially
  in-viewport in both Page-A and Page-B, but it gets tricky if you consider a
  non-sticky header that scrolled out of view by 1000s of pixels.

All of these can be overridden by the developer via CSS animations.

Note that the animation starts when Page-B is ready to render its first frame.
Developers can configure this using the [blocking
attribute](https://github.com/whatwg/html/issues/7131). The animation is
considered complete once all animations on all the ::page-transition\*
pseudo-elements finish.

### Via JavaScript

The JavaScript API extends on the capabilities of the CSS API.

```js
document.addEventListener("beforepageshow", async (event) => {
  if (!event.transition) return;
  event.transition.setElement(document.documentElement, "root");
  event.transition.setElement(document.querySelector(".header"), "header");

  await event.transition.ready;

  // The pseudo-elements are now accessible and can be animated:
  document.documentElement.animate(keyframes, {
    ...animationOptions,
    pseudoElement: "::page-transition-container(header)",
  });
});
```

`beforepageshow` is a new event which fires just before the page is shown.
Unfortunately `pageshow` fires a long after the page is shown, after
`window.onload`. The developer will have to add a listener to this somewhere
that's executed before the page is shown.

- `event.previousURL` - URL of the previous page. Is `null` if cross-origin, or
  if there was no previous page.
- `event.direction` - `forward` if moving forward in history, `back` is moving
  back in history, `new` otherwise.
- `event.transition` - `null` if Page-A did not offer any elements.
- `event.transition.data` - Data set by Page-A via `setData`.
- `event.transition.abandon()` - Abandon the transition.
- `event.transition.setElement(element, tag, options)` - Same API as in Page-A.
- `event.transition.ignoreCSSTaggedElements()` - Same API as in Page-A.

In future, this API could include:

- A way to delay the start of the transition, eg to wait for an image to load.
- A way to enumerate the pseudo elements, which will depend on
  [CSSPseudoElement](https://drafts.csswg.org/css-pseudo-4/#CSSPseudoElement-interface).

# Same-document transition API

The mechanism for cross-document transitions and SPA transitions involves the
same phases, so an SPA API will expose those parts in the same page.

```js
async function doTransition() {
  let transition = document.createDocumentTransition();
  
  // Specify offered elements. The tag below is used to refer
  // to the generated pseudo elemends in script/CSS.
  transition.setElement(document.querySelector(".old-message"), "message");
  
  // The start() call triggers an async operation to capture
  // snapshots for the offered elements,
  await transition.start(async () => {
    // This callback is invoked by the browser when the capture
    // finishes and the DOM can be switched to the new state.
    // No frames are rendered until this callback returns.
    
    // Asynchronously load the new page.
    await coolFramework.changeTheDOMToPageB();
    
    // Tag elements animated during the transition on the new page.
    transition.setElement(document.querySelector(".new-message"), "message");
    
    // Set up animations using WA-API on the next frame.
    requestAnimationFrame(() => {
      document.documentElement.animate(keyframes, {
      ...animationOptions,
      pseudoElement: "::page-transition-container(message)",
      });
    });
    
    // Note that when this callback finishes, the animations will start with the tagged elements.
  });
}
```

- `transition.setElement(element, tag, options)` - Same arguments as the MPA
  API.
- `transition.captureAndHold()` - Capture any currently offered element as
  "outgoing", and hold the current rendered view. Resolves when ready.
- `transition.start()` - Capture any offered element as "incoming", and match
  them to outgoing elements as in the MPA model.
- `transition.ignoreCSSTaggedElements()` - Same as MPA API.
- `transition.abandon()` - Same as MPA API.

This API will also capture elements with `page-transition-tag`, so it's possible
for `createDocumentTransition` to be small and have CSS handle the rest:

```js
document.createDocumentTransition(async (transition) => {
  await transition.captureAndHold();
  await coolFramework.changeTheDOMToPageB();
  transition.start();
});
```

Calling `setElement` before `captureAndHold` means that element will be captured
as both "outgoing" and "incoming", unless the element is removed before
`start()`, or is assigned a different tag via `setElement`.

# Relation to `element()`

CSS has an
[`element()`](https://drafts.csswg.org/css-images-4/#element-notation) feature
which allows the appearance of an element to be used as an image.

This doesn't quite match either of the cases where we need to capture an element
as an image.

When capturing 'as a single image', it seems much easier for developers if we
expand the capture to include things outside the border box, such as box
shadows. `element()` clips at the border box.

When capturing as a 'computed style + content image', we capture the combination
of the element's children as image, clipped to the content box. Again this is
different to `element()`.

However, these variations could be included in `element()` using modifiers or
similarly named functions (e.g. `element-children()`).
[Here](https://jsbin.com/bisoleziyi/edit?html,output) is a polyfill example of a
single image mode transition built using the existing element() support in
Firefox.

# Security/Privacy Considerations

The security considerations below cover same-origin transitions.

- Script can never read pixel content in the images. This is necessary since the
  document may embed cross-origin content (iframes, CORS resources, etc.) and
  multiple restricted user information (visited links history, dictionary used
  for spell check, etc.)
- If an element is captured as a 'computed style + content image', any external
  resources specified on the container, such as background images, will be
  re-fetched in the context of the new page to account for differences in
  sandboxing.

Cross-origin transitions aren't yet defined, but are likely to be heavily
restricted.

# Interactivity and accessibility

Page transitions are a purely visual affordance. In terms of interactivity,
transition elements will behave like `div`s regardless of the original element.

Developers could break this intent by adding interactivity directly to the
transition element, e.g. by deliberately adding a `tabindex` attribute. But this
isn't recommended.

The page transition stage will be hidden from assistive technologies such as
screen readers.

- [Open question](https://github.com/WICG/shared-element-transitions/issues/88):
  Should hit-testing ignore transition elements?
