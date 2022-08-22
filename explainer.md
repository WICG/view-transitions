# Contents

1. [Introduction](#introduction).
1. [Why do we need a new API for this?](#why-do-we-need-a-new-api-for-this) - exploring the difficulties of achieving page transitions with existing APIs.
1. [MPA vs SPA solutions](#mpa-vs-spa-solutions) - how this API covers both same-document and cross-document transitions.
1. [Revisiting the cross-fade example](#revisiting-the-cross-fade-example) - how to perform a cross-fade with this API.
1. [How the cross-fade worked](#how-the-cross-fade-worked) - exploring the behind-the-scenes detail of the cross-fade.
1. [Simple customization](#simple-customization) - changing the default cross-fade.
1. [Transitioning multiple elements](#transitioning-multiple-elements) - moving parts of the page independently.
1. [Transitioning elements don't need to be the same DOM element](#transitioning-elements-dont-need-to-be-the-same-dom-element) - creating a transition where a thumbnail 'grows' into the main content.
1. [Transitioning elements don't need to exist in both states](#transitioning-elements-dont-need-to-exist-in-both-states).
1. [Customizing the transition based on the type of navigation](#customizing-the-transition-based-on-the-type-of-navigation) - e.g. creating 'reverse' transitions for 'back' traversals.
1. [Animating with JavaScript](#animating-with-javascript) - because some transitions aren't possible with CSS alone.
1. [Compatibility with existing developer tooling](#compatibility-with-existing-developer-tooling).
1. [Compatibility with frameworks](#compatibility-with-frameworks).
1. [Error handling](#error-handling) - Ensuring DOM changes don't get lost, or stuck.
1. [Handling ink overflow](#handling-ink-overflow) - Dealing with things like box shadows.
1. [Full default styles & animation](#full-default-styles--animation).
1. [Future work](#future-work).
   1. [Cross-document same-origin transitions](#cross-document-same-origin-transitions) - MPA page transitions.
   1. [Nested transition containers](#nested-transition-containers) - cases where the 'flattened' model isn't the best model.
   1. [More granular style capture](#more-granular-style-capture) - cases where images aren't enough.
   1. [Better pseudo-element selectors](#better-pseudo-element-selectors) - because right now they kinda suck.
   1. [Transitions targeted to a specific element](#transitions-targeted-to-a-specific-element) - transitions that aren't the whole 'page'.
1. [Security/Privacy considerations](#securityprivacy-considerations).
1. [Interactivity and accessibility](#interactivity-and-accessibility).

# Introduction

Smooth page transitions can lower the cognitive load by helping users [stay in context](https://www.smashingmagazine.com/2013/10/smart-transitions-in-user-experience-design/) as they navigate from Page-A to Page-B, and [reduce the perceived latency](https://wp-rocket.me/blog/perceived-performance-need-optimize/#:~:text=1.%20Use%20activity%20and%20progress%20indicators) of loading.

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

# Why do we need a new API for this?

Typically, navigations on the web involve one document switching to another. Browsers try to [eliminate an intermediate flash-of-white](https://developer.chrome.com/blog/paint-holding/), but the switch between views is still sudden and abrupt. Until Shared Element Transitions, there was nothing developers could do about that without switching to an SPA model. This feature provides a way to create an animated transition between two documents, without creating an overlap between the lifetime of each document.

Although switching to an SPA allows developers to create transitions using existing technologies, such as [CSS transitions](https://developer.mozilla.org/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions), [CSS animations](https://developer.mozilla.org/docs/Web/CSS/CSS_Animations/Using_CSS_animations), and the [Web Animation API](https://developer.mozilla.org/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API), it's something most developers and frameworks avoid, or only do in a limited fashion, because it's harder than it sounds.

Let's take one of the simplest transitions: a block of content that cross-fades between states.

To make this work, you need to have a phase where both the old and new content exist in the document at the same time. The old and new content will need to be in their correct viewport positions, which usually means they'll be overlaying each other, while maintaining layout with the rest of the page, so you'll probably need some form of wrapper to manage that. Another reason for the wrapper is to allow the two elements to [correctly cross-fade using `mix-blend-mode: plus-lighter`](https://jakearchibald.com/2021/dom-cross-fade/). Then, the old content will fade from `opacity: 1` to `opacity: 0`, while the new content fades from `opacity: 0` to `opacity: 1`. Once that's complete, the old content is removed, perhaps along with some of the wrapper(s) that were used just for the transition.

However, there are a number of accessibility and usability pitfalls in this simple example. The phase where both contents exist at the same time creates an opportunity for users of assistive technology to get confused between the two. The transition is a visual affordance, it shouldn't be seen by things like screen readers. There's also an opportunity for the user to interact with the outgoing content in a way the developer didn't prevent (e.g. pressing buttons). The second DOM change after the transition, where the old content is removed, can create more accessibility issues, as the DOM mutation can cause an additional aria-live announcement of the same content. It's also a common place for focus state to get confused, particularly in frameworks where the new content DOM used in the transition may not be the same DOM used in the final state (depending on how virtual DOMs are diffed, it may not realize it's the same content, particularly if containers have changed).

If the content is large, such as the main content, the developer has to handle differences in the root scroll position between the two states. At the very least, one of the pieces of content will need to be offset to counteract the scroll difference between the two, and unset once the transition is complete.

And this is just a simple cross-fade. Things get an order of magnitude more complicated when page components need to transition position between the states. Folks have created [large complex plugins](https://greensock.com/docs/v3/Plugins/Flip/), built on top of even larger libraries, just to handle this small part of the problem. Even then, they don't handle cases where the element gets clipped by some parent, via `overflow: hidden` or similar. To overcome this, developers tend to pop the animating element out to the `<body>` so it can animate freely. To achieve that, the developer needs to alter their CSS so the element looks the same as a child of `<body>` as it does in its final place in the DOM. This discourages developers from using the cascade, and it plays badly with contextual styling features such as container queries.

If your site is an SPA, none of this is impossible, it's just _really hard_. With regular navigations (sometimes referred to as Multi-Page Apps, or MPAs), it is impossible.

The Shared Element Transition feature follows the trend of transition APIs on platforms like [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle)
and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions), by allowing developers to continue to update page state atomically (either through DOM changes or cross-document navigations), while defining highly tailored transitions between the two states.

# MPA vs SPA solutions

The [current spec](https://tabatkins.github.io/specs/css-shared-element-transitions/) and experimental implementation in Chrome (behind the `chrome://flags/#document-transition` flag) focuses on SPA transitions. However, the model has also been designed to work with cross-document navigations. The specifics for cross-document navigations are covered [later in this document](#cross-document-same-origin-transitions).

This doesn't mean we consider the MPA solution less important. In fact, [developers have made it clear that it's more important](https://twitter.com/jaffathecake/status/1405573749911560196). We have focused on SPAs due to the ease of prototyping, so those APIs have had more development. However, the overall model has been designed to work for MPAs, with a slightly different API around it.

# Revisiting the cross-fade example

As described above, creating a cross-fade transition using existing platform features is more difficult than it sounds. Here's how to do it with Shared Element Transitions:

```js
function spaNavigate(data) {
  // Fallback for browsers that don't support this API:
  if (!self.SameDocumentTransition) {
    updateTheDOMSomehow(data);
    return;
  }

  const transition = new SameDocumentTransition();
  transition.prepare(() => updateTheDOMSomehow(data));
}
```

_(the API is described in detail in the next section)_

And now there's a cross-fade between the states:

https://user-images.githubusercontent.com/93594/185887048-53f3695a-104d-4f50-86cc-95ce61422678.mp4

Ok, a cross-fade isn't that impressive. Thankfully, transitions can be customized, but before we get to that, here's how this basic cross-fade worked:

# How the cross-fade worked

Taking the code sample from above:

```js
const transition = new SameDocumentTransition();
transition.prepare(() => updateTheDOMSomehow(data));
```

When `.prepare()` is called, the API captures the current state of the page. This includes taking a screenshot, which is async as it happens in the render steps of the event loop.

Once that's complete, the callback passed to `.prepare()` is called. That's where the developer changes the DOM.

Rendering is paused while this happens, so the user doesn't see a flash of the new content. Although, the render-pausing has an aggressive timeout.

Once the DOM is changed, the API captures the new state of the page, and constructs a pseudo-element tree like this:

```
::page-transition
└─ ::page-transition-container(root)
   └─ ::page-transition-image-wrapper(root)
      ├─ ::page-transition-outgoing-image(root)
      └─ ::page-transition-incoming-image(root)
```

_(the specific function of each part of this tree, and their default styles, is covered [later in this document](#full-default-styles--animation))_

The `::page-transition` sits in a top-layer, over everything else on the page.

`::page-transition-outgoing-image(root)` is a screenshot of the old state, and `::page-transition-incoming-image(root)` is a live representation of the new state. Both render as CSS replaced content.

The outgoing image animates from `opacity: 1` to `opacity: 0`, while the incoming image animates from `opacity: 0` to `opacity: 1`, creating a cross-fade.

Once the animation is complete, the `::page-transition` is removed, revealing the final state underneath.

Behind the scenes, the DOM just changed, so there isn't a time where both the outgoing and incoming content existed at the same time, avoiding the accessibility, usability, and layout issues.

The animation is performed using CSS animations, so it can be customized with CSS.

# Simple customization

All of the pseudo-elements above can be targeted with CSS, and since the animations are defined using CSS, you can modify them using existing CSS animation properties. For example:

```css
::page-transition-outgoing-image(root),
::page-transition-incoming-image(root) {
  animation-duration: 5s;
}
```

With that one change, the fade is now really slow:

https://user-images.githubusercontent.com/93594/185892070-f061181f-4534-46bd-99bb-657e2bce6cb9.mp4

Or, more practically, here's an implementation of [Material Design's shared axis transition](https://material.io/design/motion/the-motion-system.html#shared-axis):

<!-- prettier-ignore -->
```css
@keyframes fade-in {
  from { opacity: 0; }
}

@keyframes fade-out {
  to { opacity: 0; }
}

@keyframes slide-from-right {
  from { transform: translateX(30px); }
}

@keyframes slide-to-left {
  to { transform: translateX(-30px); }
}

::page-transition-outgoing-image(root) {
  animation: 90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
    300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
}

::page-transition-incoming-image(root) {
  animation: 210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in,
    300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
}
```

And the result:

https://user-images.githubusercontent.com/93594/185893122-1f84ba5f-2c9d-46c6-9275-a278633f2e72.mp4

Note: In this example, the animation always moves from right to left, which doesn't feel natural when clicking the back button. How to change the animation depending on the direction of navigation is covered [later in the document](#customizing-the-transition-based-on-the-type-of-navigation).

# Transitioning multiple elements

In the previous demo, the whole page is involved in the shared axis transition. But that doesn't seem quite right for the heading, as it slides out just to slide back in again.

To solve this, Shared Element Transitions allow you to extract parts of the page to animate independently, by assigning them a `page-transition-tag`:

```css
.header {
  page-transition-tag: header;
  contain: layout;
}
.header-text {
  page-transition-tag: header-text;
  contain: layout;
}
```

_Independently transitioning elements needs to have `layout` or `paint` containment, and avoid fragmentation, so the element can be captured as a single unit._

The page will now be captured in three parts: The header, the header text, and the remaining page (known as the 'root').

https://user-images.githubusercontent.com/93594/184097864-40b9c860-480a-45ff-9787-62cebe68a078.mp4

This results in the following pseudo-element tree for the transition:

```
::page-transition
├─ ::page-transition-container(root)
│  └─ ::page-transition-image-wrapper(root)
│     ├─ ::page-transition-outgoing-image(root)
│     └─ ::page-transition-incoming-image(root)
│
├─ ::page-transition-container(header)
│  └─ ::page-transition-image-wrapper(header)
│     ├─ ::page-transition-outgoing-image(header)
│     └─ ::page-transition-incoming-image(header)
│
└─ ::page-transition-container(header-text)
   └─ ::page-transition-image-wrapper(header-text)
      ├─ ::page-transition-outgoing-image(header-text)
      └─ ::page-transition-incoming-image(header-text)
```

And without any further customization, here's the result:

https://user-images.githubusercontent.com/93594/185895421-0131951f-c67b-4afc-97f8-44aa16cfbed7.mp4

Note how the top header remains static.

As well as the cross-fade between the outgoing-image and the incoming-image, another default animation transforms the `::page-transition-container` from its before position to its after position, while also transitioning its width and height between the states. This causes the heading text to shift position between the states. Again, the developer can use CSS to customize this as they wish.

The high-level purpose of each pseudo-element:

- `::page-transition-container` - animates size and position between the two states.
- `::page-transition-image-wrapper` - provides blending isolation, so the two images can correctly cross-fade.
- `::page-transition-outgoing-image` and `::page-transition-incoming-image` - the visual states to cross-fade.

The full default styles and animations of the pseudo-elements are covered [later in the document](#full-default-styles--animation).

# Transitioning elements don't need to be the same DOM element

In the previous examples, `page-transition-tag` was used to create separate transition elements for the header, and the text in the header. These are conceptually the same element before and after the DOM change, but you can create transitions where that isn't the case.

For instance, the main video embed can be given a `page-transition-tag`:

```css
.full-embed {
  page-transition-tag: full-embed;
  contain: layout;
}
```

Then, when the thumbnail is clicked, it can be given the same `page-transition-tag`, just for the duration of the transition:

```js
thumbnail.onclick = () => {
  const transition = new SameDocumentTransition();

  thumbnail.style.pageTransitionTag = "full-embed";

  transition.prepare(() => {
    thumbnail.style.pageTransitionTag = "";
    updateTheDOMSomehow();
  });
};
```

And the result:

https://user-images.githubusercontent.com/93594/185897197-62e23bef-c198-4cd6-978e-c2e74892154b.mp4

The thumbnail now transitions into the main image. Even though they're conceptually (and literally) different elements, the transition API treats them as the same thing because they shared the same `page-transition-tag`.

This is useful for cases like above where one element is 'turning into' another, but also for cases where a framework creates a new `Element` for something even though it hasn't really changed, due to a virtual DOM diffing mismatch.

Also, this model is _essential_ for MPA navigations, where all elements across the state-change will be different DOM elements.

# Transitioning elements don't need to exist in both states

It's valid for some transition elements to only exist on one side of the DOM change, such as a side-bar that doesn't exist on the outgoing page, but exists in the incoming page.

For example, if an element only exists in the 'after' state, then it won't have a `::page-transition-outgoing-image`, and its `::page-transition-container` won't animate by default, it'll start in its final position.

# Customizing the transition based on the type of navigation

In some cases, the elements captured, and the resulting animations, should be different depending on the source & target page, and also different depending on the direction of navigation.

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

In this example, the transition between the thumbnails page and the video page is significantly different to the transition between video pages. Also, animation directions are reversed when navigating back.

There isn't a specific feature for handling this. Developers can add class names to the document element, allowing them to write selectors that change which elements get a `page-transition-tag`, and which animations should be used.

In particular, the [Navigation API](https://github.com/WICG/navigation-api) makes it easy to distinguish between a back vs forward traversal/navigation.

# Animating with JavaScript

The promise returned by `prepare()` fulfills when both states have been captured and the pseudo-element tree has been successfully built. This provides developers with a point where they can animate those pseudo-elements with the [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API).

For example, if the developer wanted to create a circular-reveal animation from the point of the last click:

```js
let lastClick;
addEventListener("click", (event) => (lastClick = event));

async function spaNavigate(data) {
  // Fallback for browsers that don't support this API:
  if (!document.createDocumentTransition) {
    updateTheDOMSomehow(data);
    return;
  }

  // With a transition:
  const transition = new SameDocumentTransition();

  await transition.prepare(() => {
    // Get the click position, or fallback to the middle of the screen
    const x = lastClick?.clientX ?? innerWidth / 2;
    const y = lastClick?.clientY ?? innerHeight / 2;
    // Get the distance to the furthest corner
    const endRadius = Math.sqrt(
      Math.max(x, innerWidth - x) ** 2 + Math.max(y, innerHeight - y) ** 2
    );

    updateTheDOMSomehow(data);
  });

  // Animate the root's incoming image
  document.documentElement.animate(
    {
      clipPath: [
        `circle(0 at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ],
    },
    {
      duration: 500,
      easing: "ease-in",
      // Specify which pseudo-element to animate
      pseudoElement: "::page-transition-incoming-image(root)",
    }
  );
}
```

And here's the result:

https://user-images.githubusercontent.com/93594/184120371-678f58b3-d1f9-465b-978f-ee5eab73d120.mp4

# Compatibility with existing developer tooling

Since this feature is built on existing concepts such as pseudo-elements and CSS animations, tooling for this feature should fit in with existing developer tooling.

In Chrome's experimental implementation, the pre-existing animation panel can be used to debug transitions, and the pseudo-elements are exposed in the elements panel.

https://user-images.githubusercontent.com/93594/184123157-f4b08032-3b4f-4ca3-8882-8bea0e944355.mp4

# Compatibility with frameworks

The DOM update can be async, to cater for frameworks that queue state updates behind microtasks. This is signaled by returning a promise from the `.prepare()` callback, which is easily achieved with an async function:

```js
const transition = new SameDocumentTransition();
await transition.prepare(async () => {
  await updateTheDOMSomehow();
});
```

However, the pattern above assumes the developer is in charge of DOM updates, which isn't the case with most web frameworks. To assess the compatibility of this API with frameworks, the [demo site featured in this explainer](https://http203-playlist.netlify.app/) was built using Preact, and uses a [React-style hook](https://github.com/jakearchibald/http203-playlist/blob/main/src/client/utils.ts#L11) to wrap the above API and make it usable with React/Preact.

As long as the framework provides a notification when the DOM is updated, which they already do to allow custom handling of elements, the transition API can be made to work with the framework.

# Error handling

This feature is built with the view that a transition is an enhancement to a DOM change. For example:

```js
const transition = new SameDocumentTransition();
await transition.prepare(() => {
  updateTheDOMSomehow();
});
```

The API could discover an error before calling the `prepare()` callback, meaning the transition cannot happen. For example, it may discover two elements with the same `page-transition-tag`, or one of the transition elements is fragmented in a way that's incompatible with the API. In this case we still call the `prepare()` callback, because the DOM change is more important than the transition, and being unable to create a transition is not a reason to prevent the DOM change.

However, if a transition cannot be created, the promise returned by `prepare()` will reject.

Error detection is also the reason why `prepare()` takes a callback, rather than a model where the developer calls a method to signal when the DOM is changed:

```js
// Not the real API, just an alternative example:
const transition = new SameDocumentTransition();
await transition.prepare();
await updateTheDOMSomehow();
transition.ready();
```

In a model like the one above, if `updateTheDOMSomehow()` throws, `transition.ready` would never be called, so the API would be in a state where it doesn't know if DOM change failed, or if it's just taking a long time. The callback pattern avoids this gotcha – we get to see the thrown error, and abandon the transition quickly.

The [Navigation API](https://wicg.github.io/navigation-api/#ref-for-dom-navigateevent-intercept%E2%91%A0%E2%91%A5) and [Web Locks API](https://w3c.github.io/web-locks/#ref-for-dom-lockmanager-request-name-options-callback%E2%91%A0) use this same pattern for the same reason.

# Handling ink overflow

Elements can paint outside of their border-box for a number of reasons, such as `box-shadow`.

The `::page-transition-outgoing-image` and `::page-transition-incoming-image` will be the border box size of the original element, but the full ink overflow will be included in the image. This is achieved via [`object-view-box`](https://drafts.csswg.org/css-images-4/#propdef-object-view-box), which allows replaced elements to paint outside their bounds.

# Animating `width` and `height`

The `::page-transition-container` animates its `width` and `height` by default, which usually means the animations will run on the main thread.

However, `width` and `height` was deliberately chosen for developer convenience, as it plays well with things like `object-fit` and `object-position`.

https://user-images.githubusercontent.com/93594/184117389-3696400b-b381-478b-9837-888650c6d217.mp4

In this example, a 4:3 thumbnail transitions into a 16:9 main image. This is [relatively easy](https://developer.chrome.com/blog/shared-element-transitions-for-spas/#handling-changes-in-aspect-ratio) with `object-fit`, but would be complex using only transforms.

Due to the simple nature of these pseudo-element trees, these animations should be able to run off the main thread. However, if the developer adds something that requires layout, such as a border, the animation will fall back to main thread.

# Full default styles & animation

## `::page-transition-container(*)`

Default styles:

```css
::page-transition-container(*) {
  /*= Styles for every instance =*/
  position: absolute;
  top: 0px;
  left: 0px;
  will-change: transform;
  pointer-events: auto;

  /*= Styles generated per instance =*/

  /* Dimensions of the incoming element */
  width: 665px;
  height: 54px;

  /* A transform that places it in the viewport position of the incoming element. */
  transform: matrix(1, 0, 0, 1, 0, 0);

  writing-mode: horizontal-tb;
  animation: 0.25s ease 0s 1 normal both running
    page-transition-container-anim-main-header;
}
```

Default animation:

```css
@keyframes page-transition-container-anim-main-header {
  from {
    /* Dimensions of the outgoing element */
    width: 600px;
    height: 40px;

    /* A transform that places it in the viewport position of the outgoing element. */
    transform: matrix(2, 0, 0, 2, 0, 0);
  }
}
```

## `::page-transition-image-wrapper(*)`

Default styles:

```css
::page-transition-image-wrapper(*) {
  /*= Styles for every instance =*/
  position: absolute;
  inset: 0px;

  /*= Styles generated per instance =*/
  /* Set if there's an outgoing and incoming image, to aid with cross-fading.
     This is done conditionally as isolation has a performance cost. */
  isolation: isolate;
}
```

Default animation: none.

## `::page-transition-outgoing-image(*)`

This is a replaced element displaying the capture of the outgoing element, with a natural aspect ratio of the outgoing element.

```css
::page-transition-outgoing-image(*) {
  /*= Styles for every instance =*/
  position: absolute;
  inset-block-start: 0px;
  inline-size: 100%;
  block-size: auto;
  will-change: opacity;

  /*= Styles generated per instance =*/

  /* Set if there's an outgoing and incoming image, to aid with cross-fading.
     This is done conditionally as isolation has a performance cost. */
  mix-blend-mode: plus-lighter;

  /* Allows the image to be the layout size of the element,
     but allow overflow (to accommodate ink-overflow)
     and underflow (cropping to save memory) in the image data. */
  object-view-box: inset(0);

  animation: 0.25s ease 0s 1 normal both running blink-page-transition-fade-out;
}
```

Note that the `block-size` of this element is auto, so it won't stretch the image as the container changes height. The developer can change this if they wish.

Default animation:

```css
@keyframes page-transition-fade-out {
  from {
    opacity: 0;
  }
}
```

## `::page-transition-incoming-image(*)`

```css
@keyframes page-transition-fade-in {
  to {
    opacity: 0;
  }
}
```

# Future work

There are parts to this feature that we're actively thinking about, but aren't fully designed.

## Cross-document same-origin transitions

Many developers are more excited about cross-document transitions than SPA transitions. We've focused on SPA transitions as it's a slightly smaller problem, and easier to prototype. However, the model has been designed to work across documents.

In the SPA API:

```js
const transition = new SameDocumentTransition();
await transition.prepare(async () => {
  await updateTheDOMSomehow();
});
```

`prepare()` is used to signal that the current state should be captured, and the promise returned by the callback passed to the API signals when the new state can be captured, and the transition can begin. Making cross-document transitions work means replacing this API with something that does the same job, but can span two documents.

Here's a rough sketch (all API names used here are for entertainment purposes only):

```js
// In the outgoing page
document.addEventListener("pagehide", (event) => {
  if (!event.isSameOriginDocumentSwap) return;
  if (looksRight(event.nextPageURL)) {
    // This signals that the outgoing elements should be captured
    event.pleaseLetTheNextPageDoATransitionPlease();
  }
});
```

```js
// In the incoming page
// (the "pageshow" event fires long after the page has shown, so we need something different)
document.addEventListener("beforepageshow", (event) => {
  if (
    event.previousPageWantsToDoATransition &&
    looksRight(event.previousPageURL)
  ) {
    const transitionReadyPromise = event.yeahLetsDoAPageTransition();
  }
});
```

This provides the same scripting points as the SPA API, allowing developers to set class names to tailor the animation to a particular type of navigation.

## Nested transition containers

In the current design, each `::page-transition-container` is a child of the `::page-transition`. This works really well in most cases, but not all:

https://user-images.githubusercontent.com/93594/184126476-83e2dbc7-ba26-4135-9d16-c498311f2359.mp4

The element moving from one container to the other benefits from the flat arrangement of `::page-transition-container`s, as it doesn't get clipped by the parent. However, the elements that remain in the container _do_ benefit from the clipping provided by the parent.

The rough plan is to allow nesting via an opt-in (all API names used here are for entertainment purposes only):

```css
.container {
  page-transition-tag: container;
  contain: paint;
}
.child-item {
  page-transition-tag: child-item;
  contain: layout;
  page-transition-style-or-whatever: nested;
}
```

With this opt in, rather than the containers being siblings:

```
::page-transition
├─ …
├─ ::page-transition-container(container)
│  └─ ::page-transition-image-wrapper(container)
│     └─ …
└─ ::page-transition-container(child-item)
   └─ ::page-transition-image-wrapper(child-item)
      └─ …
```

…the `child-item` would be nested in its closest parent that's also a transition element:

```
::page-transition
├─ …
└─ ::page-transition-container(container)
   ├─ ::page-transition-image-wrapper(container)
   │  └─ …
   └─ ::page-transition-container(child-item)
      └─ ::page-transition-image-wrapper(child-item)
         └─ …
```

## More granular style capture

By default, elements are captured as images. This means if a rounded box is transitioning into a different size box with the same border-radius, there'll be some imperfect scaling of the corners during the transition.

This often isn't as bad as it sounds in practice, particularly in fast transitions. And, developers can build custom animations with clip-paths to work around the issue in some cases. However, we are considering a different opt-in capture mode, where the computed styles of the transition elements are captured, allowing for transitions that involve layout.

In this mode, the _content_ of the element would still be an image, but the element itself would have things like the `border-radius` and `box-shadow` copied over, rather than being baked into an image.

However, since these animations would involve layout, they would need to run on the main thread.

## Better pseudo-element selectors

This feature makes use of nested pseudo-elements. It isn't the first feature to do that, as there's also `::before::marker`, but this feature has more than two levels of nesting.

Right now, all pseudo elements are accessed from the root element, which doesn't really express their nesting. However, if the nesting was fully expressed, you'd end up with selectors like:

```css
::page-transition-container(foo)::image-wrapper::outgoing-image {
  /* … */
}
```

We have proposed a new combinator to make it easier to select descendant pseudo elements https://github.com/w3c/csswg-drafts/issues/7346.

```css
::page-transition-container(foo) :>> outgoing-image {
  /* … */
}
```

This will play well with CSS nesting:

```css
::page-transition-container(foo) {
  & :>> outgoing-image {
    /* … */
  }
  & :>> incoming-image {
    /* … */
  }
}
```

## Transitions targeted to a specific element

In the current design, the transition acts across the whole document. However, developers have expressed interest in using this system, but limited to a single element. For example, allowing two independent components to perform transitions.

This is being discussed in https://github.com/WICG/shared-element-transitions/issues/52.

# Security/Privacy considerations

The security considerations below cover same-origin transitions.

- Script can never read pixel content in the images. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
- If an element is captured as a 'computed style + content image', any external resources specified on the container, such as background images, will be re-fetched in the context of the new page to account for differences in sandboxing.

Cross-origin transitions aren't yet defined, but are likely to be heavily restricted.

# Interactivity and accessibility

- Page transitions are a purely visual affordance. In terms of interactivity, transition elements will behave like `div`s regardless of the original element. Developers could break this intent by adding interactivity directly to the transition element, e.g. by deliberately adding a `tabindex` attribute. But this isn't recommended.
- The page transition stage will be hidden from assistive technologies such as screen readers.
- The duration for which DOM rendering is suppressed, to allow an author to asynchronously switch to the new DOM, input processing is also paused. This is necessary since the visual state presented to the user is inconsistent with the DOM state used for hit-testing.
