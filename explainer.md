# Introduction

(video of the page transition used to demo the concepts, but just switching from one to the other. Page has a static heading which changes size (due to scroll position), an avatar moves around inside it, and a share button stays in the same place).

When a user navigates on the web, state tends to abruptly switch from Page-A to Page-B. Sometimes this includes a flash of white, although browsers try to avoid this in some cases. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. In addition, it increases the user's perception of loading time as compared with a smooth loading animation. For these reasons, most platforms provide easy-to-use primitives that enable developers to build seamless transitions: [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

(video of the final transition)

Shared Element Transitions provides developers with the same capability on the web, irrespective of whether the transitions are cross-document or intra-document (SPA).

# Use-Cases

A visual demo of some example transition patterns targeted by this feature are [here](https://material.io/design/motion/the-motion-system.html#transition-patterns). The following is a summary of the semantics of these transition patterns:

* Root Transitions: The full page content animates between two web pages with an optional static UI element on top. Examples 1 & 2 [here](https://material.io/design/motion/the-motion-system.html#shared-axis) are demonstrations of this.
* Shared Element to Root Transitions: A persistent UI element morphs into the full page content on the next web page. [Container transform](https://material.io/design/motion/the-motion-system.html#container-transform) shows an example.
* Shared Element Transitions: A persistent UI element morphs into another UI element on the next web page. The element's contents and shape can change during this transition. This [video](https://www.youtube.com/watch?v=SGnZN3NE0jA) shows an example.
* Entry/Exit Transitions: A UI element animates as it exits or enters the screen. This [issue](https://github.com/WICG/shared-element-transitions/issues/37) shows an example.

# Design

Performing a transition from Page-A to Page-B requires parts of both to be on screen at the same time, potentially moving independently. This is currently impossible in a cross-document navigation, but it's still hard in an SPA (single page app) navigation. You need to make sure that the outgoing state can't receive additional interactions, and ensure the presence of both states doesn't create a confusing experience for those using accessibility technology.

The aim of this design is to allow for representations of both Page-A and Page-B to exist at the same time, without the usability, accessibility, or memory concerns of having both complete DOM trees alive.

Here's the example that will be used to explain the design:

<img alt="Page-A and Page-B" src="media/pages.png?raw=true">

The transition between Page-A and Page-B can be a full cross-document navigation between two same-origin pages, or it can be an SPA navigation. The main mechanism and concepts are the same between the two.

## Part 1: The offering

Before Page-A goes away, it offers up parts of itself to be used in the transition. Generally, this will mean one part per 'thing' that will act independently during the transition. For the example transition, the parts are:

- The header container
- The header content
- The share button
- The rest

(video showing the page being pulled apart in this way)

To avoid the risks, complexities, and memory impact of fully preserving these parts of Page-A, they're retained as a bitmap at their current CSS size, multiplied by the device pixel ratio.

The captured area is limited to the border box, because ???. This makes the example tricky due to the shadow on the header, which would be completely clipped away, and the shadow on the share button, which would be partially clipped away. The developer cannot expand the captured area because ???.

The workaround for this sees the developer manually removing these styles during the offering phase, and having Page-B reapply them manually later. See the API section for more details. The complexity here is worth it because ???.

In this case, since the header content moves independently of the header itself, the background of the header will also need to be removed and reapplied manually later. The complexity here is worth it because ???.

(3-col video showing share button original, captured, and reapplied)

'The rest' is referred to as the 'root'. Rather than capturing the whole page, which would take an enormous amount of memory in some cases, only the area within the viewport is captured. The developer cannot expand the captured area because ???.

Other captured elements may expand vastly beyond the viewport, but this isn't a concern because ???.

## Part 2: The preparation

The state changes over to Page-B, and Page-A is gone aside from the parts it offered.

An overlay is automatically created in the top level, and the offered parts from Page-A are automatically laid out in their previous viewport-relative positions.

(video showing the page being reassembled, but not with their reapplied styles)

Each transition element at this stage is represented by a container pseudo-element and a pseudo-element child.

```
├ Transition container
│ └ Transition child
└ Transition container
  └ Transition child
```

The transition container maintains the box size of the original element, whereas the transition child holds an image of the captured appearance.

These elements can be styled with CSS, and this is where the developer must manually re-add things that appear outside the border-box clipping area.

(video of styles being reapplied)

Assuming the developer gets the manual parts correct, the switch from Page-A to this state is seamless – the user will not see a flash of Page-B, or Page-A with intermediate removed styles.

At this stage, Page-B identifies parts of its own page to be involved in the transition. This happens in the same way as part 1, including the clipping, and the necessary manual removing and reapplying of particular styles.

(video showing removal of styles, and copying them out of the page)

The only difference between the elements captured from Page-A and those captured from Page-B, is the appearance of content captured from Page-B will update if the underlying content updates. Among other things, this means videos, gifs, and other animated content will update as expected, whereas the content captured from Page-A is static.

Some of the captured parts of Page-B can be linked to Page-A parts, if they're equivalent elements. In this case, the headers, share buttons, and roots are equivalent. When this happens, the child from the Page-B capture is added to the Page-A equivalent container.

```
├ Transition container
│ ├ Transition child (Page-A)
│ └ Transition child (Page-B)
```

This allows for the container to be moved as one, while cross-fading the Page-A and Page-B content.

Part don't need to be linked, which allows for transitions involving elements that are only in Page-A or only in Page-B.

## Part 3: The transition

Everything is now in place to perform the transition. The developer can move the parts around using the usual APIs, such as CSS and web animations.

(video of the final transition)

## Part 4: The end

The transition is assumed to be complete when ???. At this point, the top level is removed, revealing the real Page-B.

# The API

Let's take the example below which shows how the API can be used by a developer
to animate the background and a shared element on a same origin navigation
(MPA). The SPA equivalent of this case is one where the old document is mutated
into the new document via DOM APIs. See [API Extensions](#api-extensions) for
more code examples.

Note that the API shape below is tentative and used to explain the core feature
design.

### Old Document

```html
<html>
<head>
  <style>
    body {
      background-color: blue;
    }
    .animated {
      position: relative;
      top: 300px;
      width: 100px;
      height: 100px;
      background-color: red;
    }
  </style>
</head>
<body>
  <div class="animated" sharedid="header-id" id="header">Shared Element</div>
  <a href="new-document.html">Click Me</a>
</body>
</html>
```

### New Document

```html
<html>
<head>
  <style>
    body {
      background-color: lightblue;
    }
    .animated {
      position: relative;
      top: 100px;
      width: 200px;
      height: 200px;
      background-color: green;
    }

    ::shared-container(header-id) {
      animation: ::shared-container-header-id 1s ease-in;
    }
  </style>
</head>
<body>
  <div class="animated" sharedid="header-id" id="header">Shared Element</div>
</body>
</html>
```

The steps taken by the browser during the transition are as follows.

1.  When the user presses "Click Me" and a navigation is initiated on the old
    Document, create the following pseudo-elements in the top layer[^1]. Note
    that a shared element must not be nested inside another shared element :

    a. A container pseudo-element and child replaced pseudo-element for each
    element with the `sharedid` attribute. These are identified
    via ::shared-container(shared_id) and ::shared-old(shared_id) respectively,
    where shared_id is the value of the `sharedid` attribute.

    b. A replaced pseudo-element for the root/html element identified
    via ::shared-old-root.

    c. The box hierarchy in the top layer stacking context is :

    ```
    ├───shared-old-root
    ├───shared-container(header-id)
         ├───shared-old(header-id)
    ```

2.  Apply the following UA stylesheet to the pseudo elements on the old page :

    ```css
    ::shared-old-root, ::shared-container(header-id) {
      position: fixed;
      top: 0px;
      left: 0px;
    }

    ::shared-old-root {
      width: 100vw;
      height: 100vh;
      // The output of element() function on the root element.
      content: element(html);
    }

    ::shared-container(header-id) {
      /* This size is is chosen exactly according to the header-id element's
       border box dimensions after layout. */
      width: 100px;
      height: 100px;

      /* A transform positioning the element relative to the viewport so that it overlaps
       exactly with its screen coordinates and orientation it had on the old page. */
      transform: translate(8px, 308px);
    }

    ::shared-old(header-id) {
      position: absolute;
      width: 100%;
      height: 100%;
      content: element(header-id);
    }
    ```

3.  Save the output of the element() function for each pseudo element referenced
    above with the computed size and transform applied to container elements.

4.  Navigate to the new page leaving the last rendered pixels of the old page on
    screen.

5.  When the new page loads, suppress rendering until resources required for
    first render have been fetched.

6.  Once the page is ready for first render, create the following pseudo
    elements in the top layer. The pseudo elements are kept in sync with the
    corresponding shared elements in the DOM until the transition completes as
    specified in step 8 :

    a. A container pseudo-element and child replaced pseudo-element for each
    shared element on the old page using state saved in step 3.

    b. A container pseudo-element and child replaced pseudo-element for each
    element with the `sharedid` attribute on the new page. The container is
    reused if already present.

    c. A replaced element for the root/html element identified
    via ::shared-new-root.

    d. The box hierarchy in the top layer stacking context is :

    ```
    ├───shared-new-root
    ├───shared-old-root
    ├───shared-container(header-id)
         ├───shared-new(header-id)
         ├───shared-old(header-id)
    ```

7.  Apply the following UA stylesheet to the pseudo elements on the new page.

    ```css
    ::shared-old-root, ::shared-new-root, ::shared-container(header-id) {
      position: fixed;
      top: 0px;
      left: 0px;
    }

    ::shared-old-root, ::shared-new-root {
      width: 100vw;
      height: 100vh;
      content: element(html);
    }

    /* Update the container's size and transform to the shared element on the new page. */
    ::shared-container(header-id) {
      width: 200px;
      height: 200px;
      transform: translate(8px, 108px);

      /* The blend mode referenced below is not currently exposed with mix-blend-mode. */
      isolation: isolate;
      mix-blend-mode: [plus-lighter](https://drafts.fxtf.org/compositing/#porterduffcompositingoperators_plus_lighter);
    }

    ::shared-old(header-id), ::shared-new(header-id) {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    ::shared-old-root {
      /* This is the saved output referenced in step 3. */
      content: cached-element(html);
    }
    ::shared-old(header-id) {
      content: cached-element(header-id);
    }

    ::shared-new-root {
      content: element(html);
    }
    ::shared-new(header-id) {
      content: element(header-id);
    }

    /* Default animations added by the UA which can be overridden by the developer stylesheet/script. */
    @keyframes ::shared-new-fade-in {
      0% {opacity: 0;}
      100% {opacity: 1;}
    }
    ::shared-new-root, ::shared-new(header-id) {
      animation: ::shared-new-fade-in 0.25s;
    }

    @keyframes ::shared-old-fade-out {
      0% {opacity: 1;}
      100% {opacity: 0;}
    }
    ::shared-old-root, ::shared-old(header-id) {
      animation: ::shared-old-fade-out 0.25s;
    }

    /* Generated for each shared element with the syntax shared-container-sharedid. */
    @keyframes ::shared-container-header-id {
      from {
        width: 100px;
        height: 100px;
        transform: translate(8px, 308px);
      }
    }
    ::shared-container(header-id) {
      animation: ::shared-container-header-id 0.25s;
    }
    ```

8.  When the transition finishes, remove all pseudo elements from the top layer.
    The transition finishes when there is no active animation on any pseudo
    element. See
    [issue 64](https://github.com/WICG/shared-element-transitions/issues/64) for
    discussion on this.

An example simulating the steps above using the existing `element()` function
is [here](https://jsbin.com/niqiqididu/edit?html,output) (open in Firefox[^2]).

[![Video Link for Shared Element Transition](https://img.youtube.com/vi/QzGEBUW-3U8/0.jpg)](https://youtu.be/QzGEBUW-3U8)

## Animating Box Decoration CSS Properties

A common capability desirable during transitions is to interpolate styles like
border-radius that change the element's shape. The
[container transform](https://material.io/design/motion/the-motion-system.html#container-transform)
examples show a visual demo of that. Painting properties like the element's
border within its image when using the element() function makes this difficult.

Consider the same example as above with the addition of box decorations to
the shared element.

### Old Document

```html
<html>
<head>
  <style>
    body {
      background-color: blue;
    }

    .animated {
      position: relative;
      top: 300px;
      width: 100px;
      height: 100px;
      background-color: red;

      border: 10px solid black;
      border-radius: 10% 10%;
      box-shadow: 0px 0px 10px;
    }

    .animated:transition {
      /* Retain the border to ensure it is painted transparent but the box size is unchanged. */
      border: 10px solid transparent;
      border-radius: none;
      box-shadow: none;
    }

    ::shared-container(header-id) {
      border: 10px solid black;
      border-radius: 10% 10%;
      box-shadow: 0px 0px 10px;
    }

    /* Offset the image to account for the border in the snapshot. */
    ::shared-old(header-id) {
      top: -10px;
      left: -10px;
    }
  </style>
</head>
<body>
  <div class="animated" sharedid="header-id" id="header">Shared Element</div>
</body>
</html>
```

### New Document

```html
<html>
<head>
  <style>
    body {
      background-color: blue;
    }

    .animated {
      position: relative;
      top: 100px;
      width: 200px;
      height: 200px;
      background-color: green;

      border: 5px solid black;
      border-radius: 50% 50%;
      box-shadow: 0px 0px 5px;
    }

    .animated:transition {
      border: 5px solid transparent;
      border-radius: none;
      box-shadow: none;
    }

    ::shared-container(header-id) {
        border: 5px solid black;
        border-radius: 50% 50%;
        box-shadow: 0px 0px 5px;
    }

    ::shared-new(header-id) {
      top: -5px;
      left: -5px;
    }

    @keyframes border-animation {
      from {
        border: 10px solid black;
        border-radius: 10% 10%;
        box-shadow: 0px 0px 10px;
      }
    }
    ::shared-container(header-id) {
      animation: ::shared-container-header-id 1s ease-in, border-animation 1s ease-in;
    }

    @keyframes position-animation {
      from {
        top: -10px;
        left: -10px;
      }
      to {
        top: -5px;
        left: -5px;
      }
    }
    ::shared-old(header-id), ::shared-new(header-id) {
      animation: position-animation 1s ease-in;
    }

  </style>
</head>
<body>
  <div class="animated" sharedid="header-id" id="header">Shared Element</div>
</body>
</html>
```

The additional steps taken by the browser in the example above are :

i. When a pseudo element is created for shared elements in the old page in step
1, the pseudo-class "transition" is enabled for each shared element.

ii. In step 3 when saving state from the old page, the completed ComputedStyle
on the pseudo elements is saved in addition to the computed size and transform.

iii. In step 7 when applying a UA stylesheet to pseudo elements on the new page,
the saved style is also applied to the old pseudo elements :

```css
::shared-container(header-id) {
  /* This is the saved output referenced in step 3. Applied before updating to
   values from the shared element in the new DOM. */
  width: 100px;
  height: 100px;
  transform: translate(8px, 308px);
  border: 10px solid black;
  border-radius: 10% 10%;
  box-shadow: 0px 0px 10px;
}

::shared-old(header-id) {
  position: absolute;
  width: 100%;
  height: 100%;

  /* This is the saved output referenced in step 3. */
  content: cached-element(header-id);
  top: -10px;
  left: -10px;
}
```

An example simulating the steps above using the existing `element()` function
is [here](https://jsbin.com/vesokanumu/edit?html,output) (open in Firefox).

[![Video Link for Shared Element Transition](https://img.youtube.com/vi/SGnZN3NE0jA/0.jpg)](https://youtu.be/SGnZN3NE0jA)

## Modifications to element()

The following changes will be made to the element() spec as a part of this
proposal. The element captured by this function is the target element :

*   The target element must have paint containment (contain:paint) to ensure the
    element is the containing block for all positioned descendents and generates
    a stacking context.
*   The target element must disallow fragmentation (similar to
    `break-inside:avoid`).
*   A new cached-element() function is introduced to refer to the saved output
    of the element() function in step 3 of the design. (This part may not be
    developer exposed though.)
*   Nested shared elements are omitted from the output of element() function.
*   Elements captured using element() and displayed via pseudo-elements during
    the transition are not painted in the regular DOM - they behave as if they
    have `content-visibility: hidden`, except that they don't have
    `contain:size`.
*   The special cases when running the `element()` function on the html element
    are :
    *   The natural size for the generated image is the visual viewport bounds.
    *   When creating the image, the element is drawn on a canvas with the
        background color of the document.

# API Extensions

## SPA

The SPA code requires the addition of script APIs which provide the equivalent
of "navigation" and "ready for first render" events referenced in step 1 and 4
of the design. The rest of the code is identical between MPA and SPA.

```js
function handleTransition() {
  document.documentTransition.prepare(async () => {
    await loadNextPage();
  });
}
```

*   The prepare API initiates step 1 to 3 to save the state of shared elements
    in the current DOM. The API takes a callback once the save operation
    finishes executing.
*   The async callback initiates load of the next page and initiates step 4
    which suppresses rendering.
*   When the callback returns, the new DOM is considered ready for first render.
    This starts step 5 onwards to create new pseudo elements and start
    animations.

## Additional Script APIs

The following example shows how developers can configure the transition in
script for an MPA.

### Old Document

```js
addEventListener("navigate", (event) => {
  // Add sharedid attribute to elements to offer for the transition
  // based on current document state.
  document.querySelector(".header").sharedid="header-id";

  // setData can be used to pass opaque contextual information to the
  // new page. The argument type is |any|.
  document.documentTransition.setData({ version: 123 });
});
```

### New Document

```js
requestAnimationFrame(() => {
  let pendingTransition = document.documentTransition.getPendingTransition();
  if (pendingTransition.getData().version !== 123)
    return;

  // |offeredTransitionElements| provides a list of objects to access state
  // saved from the old page.
  let oldHeader = pendingTransition.offeredTransitionItems.get("header-id");
  if (oldHeader) {
    // Add sharedid attribute to elements animated in the new DOM.
    document.querySelector(".header").sharedid="header-id";

    // Query the style information saved from the old page.
    let oldHeaderStyle = oldHeader.getContainerComputedStyle();

    // The pseudo elements for each shared element are associated with the root element.
    // The existing [pseudoElement](https://drafts.csswg.org/web-animations-1/#dom-keyframeeffect-pseudoelement) option can be used
    // to target them with Web Animations API.
    document.documentElement.animate(
      [{ width: oldHeaderStyle.width,
        height: oldHeaderStyle.height,
        transform: oldHeaderStyle.transform }],
      { duration: 1000,
        pseudoElement: '::shared-container(header-id)' });
  }
});
```

# Alternatives Considered

## Heirarchical Properties

This proposal disallows a shared element to be nested inside another shared
element. The restriction avoids the need to preserve the hierarchy of the shared
elements and associated properties (transform, clip, effects inherited by
descendents) when creating pseudo elements. This is a consideration for future
iterations of the feature.

## Container/Child Split

One consideration is to render each shared element using a replaced element
directly instead of creating a container element. The motivation behind this
split is to provide a stacking context to cross-fade the content of old and new
shared elements. This is necessary to ensure blending identical pixels is a
no-op using
[plus-lighter](https://drafts.fxtf.org/compositing/#porterduffcompositingoperators_plus_lighter)
blending. While same-origin transitions could work around this, it enables
future extensibility for cross-origin transitions where cross-fading identical
images would be common.

## Natively Supporting Animating Box Decoration CSS Properties

An alternate approach to the setup described in
[Animating Box Decoration CSS Properties](#live-animatable-properties) is to
support this natively in the browser by introducing a new `content-element()`
function. This function would behave similarly to the `element()` function
except skipping the following properties when painting the element: box
decorations and visual effects which generate a stacking context. The image
would also be sized to the element's content-box (as opposed to the border-box
used by the element() function). The motivation for supporting this natively
would be to make these properties animatable instead of requiring developers to
implement it themselves.

# Security/Privacy Considerations

The security considerations below cover same-origin transitions. These are a
subset of what's required for cross-origin transitions :

*   Script can never read pixel content for images generated using the element()
    function. This is necessary since the document may embed cross-origin
    content (iframes, CORS resources, etc.) and multiple restricted user
    information (visited links history, dictionary used for spell check, etc.)
*   The Live Animatable Properties could reference resources which are
    restricted in the new document for an MPA navigation. For example, the old
    page may use a cross-origin image for border-image which can't be accessed
    by the new page due to differences in
    [COEP](https://wicg.github.io/cross-origin-embedder-policy/). Fetching these
    styles will fail on the new page. For same-origin navigations, the developer
    already has knowledge of the cross-origin policy on the new page. They can
    ensure not to reference cross-origin resources in the properties made live.

# Related Reading

An aspect of the feature that needs to be defined is the
[type of navigations](https://github.com/WICG/app-history#appendix-types-of-navigations)
that the old page can configure. We expect this will closely align with the
navigations that can be observed by the page using app-history's
[navigate event](https://github.com/WICG/app-history#restrictions-on-firing-canceling-and-responding).

[^1]: The pseudo elements in the top layer will not have an associated
    [::backdrop](https://fullscreen.spec.whatwg.org/#::backdrop-pseudo-element)
    that is created for other elements in the top layer.
[^2]: There is a double draw of the shared element in the demo since it
    continues to paint in the original DOM/the snapshot of the root element.
    This is addressed in the proposed modifications to the element() function.
