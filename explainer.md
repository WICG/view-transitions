# Introduction
When a user navigates on the web, they get to see the inner workings of web experiences: flash of white followed by a piece-meal rendering phase. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. Not only that, a smooth animation to transition between scenes also reduces the loading latency perceived by the user even if the actual loading time is the same. For these reasons, most platforms provide easy to use primitives to enable developers to build seamless transitions: [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

This feature provides developers with the same capability on the web, irrespective of whether the scenes in a transition are rendered across Documents.

# Use-Cases
A visual demo of the transition patterns targeted by this feature are [here](https://material.io/design/motion/the-motion-system.html#transition-patterns). The following is a summary of the semantics of these transition patterns :

* Root Transitions : The full page content animates between 2 web pages with an optional static UI element on top. [Shared axis](https://material.io/design/motion/the-motion-system.html#shared-axis) shows an example.
* Shared Element Transitions : A persistent UI element morphs into another (which could be a UI element on the next page or the whole page) changing its shape and content. [Container transform](https://material.io/design/motion/the-motion-system.html#container-transform) shows an example.
* Entry/Exit Transitions : A UI element animates as it exits or enters the screen. This [issue](https://github.com/WICG/shared-element-transitions/issues/37) shows an example.

These transitions should be feasible in SPAs (Single Page Apps) and MPAs (Multi Page Apps).

# Glossary

| Term | Description |
| ------------- | ------------- |
| Outgoing Document  | The document the user is viewing when a navigation is initated. For the SPA case, this is effectively the old version of the DOM. |
| Incoming Document  | The document which will be current in the session history when a navigation is committed. For the SPA case, this is effectively the incoming version of the DOM. |

# Concepts
The design for this feature is built using the following concepts:

## Transition DOM Representation
During a transition, the browser creates and animates a post layout representation of the DOM. This representation is created by generating/caching the following state for a set of elements (referred to as "shared elements") specified by the developer.

### Painted Content
A painted representation of an element animated as an atomic unit/layer during the transition. The representation effectively provides the element's content as a rendered image. This is defined using the existing [element()](https://drafts.csswg.org/css-images-4/#element-notation) function. The image animated during the transition is live for elements in the incoming document as defined in the spec. And a static version is cached by the browser for elements in the outgoing document.

This proposal outlines the following modifications to the element() spec for ease of implementation:
* The snapshotted element must have paint containment (contain:paint) to ensure the element is the containing block for all positioned descendents and generates a stacking context.
* The snapshotted element must disallow fragmentation (break-inside:avoid).

Generating this for the root element needs to be refined. The following is the list of special cases to consider there :
* The natural size for the generated image is the visual viewport bounds.
* When creating the image, the element is drawn on a canvas with the background color of the document.

### Computed Properties
The DOM state required to display the list of images/layers generated above to close visual fidelity with their rendering in the actual DOM. This is limited to the transform mapping a shared element to its quad in viewport space and the element's border-box size. Similar to painted representation above, this state is live for elements in the incoming document and a static cached version for elements in the outgoing document.

This proposal disallows a shared element to be nested inside another shared element to avoid preserving the hierarchy of these DOM elements and associated properties (transform, clip, effects inherited by descendents). This helps in limiting the scope for the first iteration of this feature.

## Rendering Transition DOM
The DOM representation referenced above is rendered and animated by creating pseudo elements with the [content](https://drafts.csswg.org/css-content/#content-property) property set to a shared element's painted content, the [transform](https://drafts.csswg.org/css-transforms-1/#propdef-transform) set to the viewport space transform and width/height set to the element's border-box size. These pseudo elements are drawn on top of the document by painting them in the DOM's [top layer](https://fullscreen.spec.whatwg.org/#top-layer) retaining their paint order in the actual DOM.

# Design
This section describes the high level design for this feature with a tentative API:

## Outgoing Document
The transition sequence starts with the prepare phase when the browser receives a trigger for a transition. Consider the following snippet of code:

```js
<div shared-id="shared-elem"></div>

// MPA version.
addEventListener("navigate", (event) => {
  document.querySelector(".foo").shared-id="header";
  document.documentTransition.setData({ version: 123 });
});

// SPA version.
function handleTransition() {
  document.querySelector(".foo").shared-id="shared-elem";
  document.documentTransition.setData({ version: 123 });
  document.documentTransition.prepare().then(() => {
    // Invoked when the prepare phase finishes.
  });
}
```

The first step is identifying shared elements. A incoming "shared-id" attribute on Element provides a unique identifier to tag shared elements. This can be specified directly in the markup or added in script based on the current document state when the transition is initiated. The setData API takes a structured cloneable to allow developers to pass opaque contextual information for the transition to the incoming document.

In the SPA case, the transition trigger is the prepare API invoked by the developer before updating the DOM to the next scene. In the MPA case, the trigger is a same-origin cross-document navigation. On receiving this trigger the browser performs the following operations:
* Creates pseudo elements for each shared element (elements with a shared-id) using the live version of state referenced in [Transition DOM Representation](#transition-dom-representation) and adds them to the top layer.
* Hides the shared element in the actual DOM since its being displayed in the Transition DOM.
* Starts an async operation to cache this state on the next rendering lifecycle update.

When the async operation finishes, the pseudo elements are switched to use the cached state. In the SPA case, the developer is notified of this event (using the promise returned by initiateTransition() API). The DOM can then be asynchronously updated to the next scene. In the MPA case, the outgoing document can be unloaded after the operation finishes. When the incoming document starts loading, this cached state is copied to the incoming document's top layer.

The cached state will provide the first frame when animations for the transition are started.

## Incoming Document
When the incoming document is loading, it's top layer keeps displaying the static DOM representation of the outgoing document until it is ready for first render, i.e, the resources required for the first frame have been fetched or timed out. This decision is made as follows:

* In the SPA case, an explicit signal is provided by the developer. For instance, with the start() API below :
```js
  document.documentTransition.prepare().then(async () => {
    await loadNextPage();
    document.documentTransition.start();
  });
```
* In the MPA, this decision can be driven by browser heuristics. The eventual goal is to give more control to developers using a [renderblocking](https://github.com/whatwg/html/issues/7131) attribute.

Once the incoming document is ready for first render, the browser creates pseudo elements using the live version of shared elements in the incoming DOM similar to the prepare operation in the outgoing DOM. This is deferred until ready for first render to avoid animating to an incremental/unstyled version of the incoming document (within a timeout) as its loading.

Similar to the outgoing document, the shared elements can be tagged directly in the markup or in script. The motivation for the script version is to enable developers to configure the transition using information provided by the outgoing document and resources fetched when the incoming document reaches ready for first render. This is done using the requestAnimationFrame callbacks dispatched during the first rendering lifecycle after ready for first render [^1].
```js
requestAnimationFrame(() => {
  let pendingTransition = document.documentTransition.getPendingTransition();
  if (pendingTransition.getData().version !== 123)
    return;
  // Provides the set of shared-ids for shared elements offered by the outgoing page.
  if (pendingTransition.offeredSharedElements().has("header"))
    document.querySelector(".foo").shared-id="header";
});
```

Developers can now customize any animation on the Transition DOM. This state is retained until there is an active animation on any pseudo element.

## Transition DOM Details
For each shared element we create 2 type of pseudo elements that can be targeted by the developer : a container element for the shared element's computed properties (the viewport space transform and border-box size) and a replaced element displaying the shared element's painted content.

One of the motivations behind this split is to provide a stacking context to cross-fade the painted content of incoming and outgoing shared elements. This was necessary to ensure blending identical pixels is a no-op using [plus-lighter](https://drafts.fxtf.org/compositing/#porterduffcompositingoperators_plus_lighter) blending. While same-origin transitions could avoid this, it enables future extensibility for cross-origin transitions where cross-fading identical images would be common.

The example below shows the setup of pseudo elements for a navigation sequence :

* Let's take the following example of an outgoing document before the transition trigger.
```
HTML (root)
├───body
    ├───div "shared-id=A"
    ├───div "shared-id=B"
```

* During the prepare phase, the Transition DOM added to the top-layer is created as follows. shared-container(#shared-id) refers to the container element while shared-old(#shared-id) is the replaced element for the painted content. "root" is a special keyword for the root element. The properties on the shared-container come from the live [computed properties](#computed-properties) of the corresponding shared element.
```
top-layer
├───shared-old(root)
├───shared-container(#A)
├        ├───shared-old(#A)
├───shared-container(#B)
         ├───shared-old(#B)
```

* The top-layer state is copied to the incoming Document while its loading. The properties on the shared-container come from the cached [computed properties](#computed-properties) of the shared element in the outgoing Document. The following is an example of the incoming document when it is ready for first render.
```
HTML (root)
├───body
    ├───div "shared-id=A"
    ├───div "shared-id=C"
```

* After ready for first render, the top layer is populated with the Transition DOM for the incoming Document. The properties on the shared-container flip to the live [computed properties](#computed-properties) of the shared element in the incoming Document.
```
top-layer
├───shared-new(root)
├───shared-old(root)
├───shared-container(#A)
├        ├───shared-new(#A)
├        ├───shared-old(#A)
├───shared-container(#B)
         ├───shared-old(#B)
├───shared-container(#C)
         ├───shared-new(#C)
```

The following is an example of a **UA generated stylesheet** to clarify the setup of these elements. These can be overriden by the developer.

```
// New syntax to style the pseudo container element.
::shared-container(#A) {
  position: fixed;
  top: 0px;
  left: 0px;
  box-sizing: border-box;
}

// New syntaxt to style pseudo old and new replaced elements.
::shared-old(#A), ::shared-new(#A) {
  position: absolute;
  top: 0px;
  left: 0px;
  width: 100%;
  height: 100%;
}
```

## Customizing Transitions
Developers can customize and specify animations for the transition by targeting the pseudo elements in CSS or script. The following is an example for a shared element transition done using CSS:

```
@keyframes fade-out {
  from {
    opacity: 1;
  }
}
::shared-old(#A) {
  opacity: 0;
  animation: fade-out;
  object-fit: cover;
  object-position: top center;
}

@keyframes fade-in {
  from {
    opacity:0;
  }
}
::shared-old(#A) {
  opacity: 1;
  animation: fade-in;
}

// Easing curve/duration for change in element's transform and bounds.
::shared-container(#A) {
  transition: all 1s ease-out;
}
```

For specifying animations using script, we will expose the [Animatable interface](https://drafts.csswg.org/web-animations/#the-animatable-interface-mixin) for the same pseudo elements.

An API is also needed to customize the paint order of these elements.

## Live Animatable Properties
A common capability desirable for multiple use-cases during transitions was to interpolate styles like border-radius that change the element's shape. The [container transform](https://material.io/design/motion/the-motion-system.html#container-transform) example show a visual demo of that. Painting properties like the element's border within its image when using the element() function makes this difficult.

Developers can control which properties are painted in the element vs interpolated by removing them from the shared element during the transition and adding them to the container instead. A new pseudo class is introduced which is applied when an element is in transition state, i.e., its being displayed in the Transition DOM. The following is an example of developer provided CSS to animate an element's border, border-radius and box-shadow during the transition. A working example of this using the existing element() function in Firefox is [here](https://jsbin.com/fifupusuvo/1/edit?html,output).

Note : Supporting this requires the browser to copy the complete ComputedStyle for the pseudo elements in the Transition DOM from outgoing to incoming document, as opposed to only the [computed properties](#computed-properties).

```
.shared-element {
  border: 10px solid black;
  border-radius: 10% 10%;
  box-shadow: 0px 0px 10px;
  
  &:transition {
    /* Retain the border to ensure it is painted transparent but the box size is unchanged. */
    border: 10px solid transparent;
    border-radius: none;
    box-shadow: none;
  }
}

::shared-container(#shared-id) {
  border: 10px solid black;
  border-radius: 10% 10%;
  box-shadow: 0px 0px 10px;
}

::shared-old(#shared-id) {
  top: -10px;
  left: -10px;
}
```

An alternate approach to this is to support this natively in the browser by introducing a new content-element() function. This function would behave similar to the element() function except skipping the following properties when painting the element: box decorations and visual effects which generate a stacking context. The image will also be sized to the element's content-box (as opposed to the border-box used by the element() function). The motivation for supporting this natively would be to ensure ease of use for developers.

# Security/Privacy Considerations
The security considerations below are limited to same-origin transitions :

* Script can never read pixel content for images generated using the element() function. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
* The Live Animatable Properties could reference resources which are restricted in the incoming document for an MPA navigation. For example, the outgoing document may use a cross-origin image for border-image which can't be accessed by the incoming document due to differences in [COEP](https://wicg.github.io/cross-origin-embedder-policy/). Fetching these styles will fail on the incoming document. For same-origin navigations, the developer already has knowledge of the cross-origin policy on the incoming document. They can ensure not to reference cross-origin resources in the properties made live.

# Related Reading
An aspect of the feature that needs to be defined is the [type of navigations](https://github.com/WICG/app-history#appendix-types-of-navigations) that the outgoing page can configure. We expect this will closely align with the navigations that can be observed by the page using app-history's [navigate event](https://github.com/WICG/app-history#restrictions-on-firing-canceling-and-responding).

[^1]: Note that for MPA this should be the rAF for the new Document's first rendering lifecycle update. Standardization of this behaviour is a part of the [renderblocking](https://github.com/whatwg/html/issues/7131) proposal.
