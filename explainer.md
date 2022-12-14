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
1. [Cross-document same-origin transitions](#cross-document-same-origin-transitions) - MPA page transitions.
1. [Compatibility with existing developer tooling](#compatibility-with-existing-developer-tooling).
1. [Compatibility with frameworks](#compatibility-with-frameworks).
1. [Error handling](#error-handling) - Ensuring DOM changes don't get lost, or stuck.
1. [Handling ink overflow](#handling-ink-overflow) - Dealing with things like box shadows.
1. [Full default styles & animation](#full-default-styles--animation).
1. [Future work](#future-work).
   1. [Nested transition containers](#nested-transition-groups) - cases where the 'flattened' model isn't the best model.
   1. [More granular style capture](#more-granular-style-capture) - cases where images aren't enough.
   1. [Better pseudo-element selectors](#better-pseudo-element-selectors) - because right now they kinda suck.
   1. [Transitions targeted to a specific element](#transitions-targeted-to-a-specific-element) - transitions that aren't the whole 'page'.
1. [Security/Privacy considerations](#securityprivacy-considerations).
1. [Interactivity and accessibility](#interactivity-and-accessibility).

# Introduction

Smooth page transitions can lower the cognitive load by helping users [stay in context](https://www.smashingmagazine.com/2013/10/smart-transitions-in-user-experience-design/) as they navigate from Page-A to Page-B, and [reduce the perceived latency](https://wp-rocket.me/blog/perceived-performance-need-optimize/#:~:text=1.%20Use%20activity%20and%20progress%20indicators) of loading.

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

# Why do we need a new API for this?

Typically, navigations on the web involve one document switching to another. Browsers try to [eliminate an intermediate flash-of-white](https://developer.chrome.com/blog/paint-holding/), but the switch between views is still sudden and abrupt. Until View Transitions, there was nothing developers could do about that without switching to an SPA model. This feature provides a way to create an animated transition between two documents, without creating an overlap between the lifetime of each document.

Although switching to an SPA allows developers to create transitions using existing technologies, such as [CSS transitions](https://developer.mozilla.org/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions), [CSS animations](https://developer.mozilla.org/docs/Web/CSS/CSS_Animations/Using_CSS_animations), and the [Web Animation API](https://developer.mozilla.org/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API), it's something most developers and frameworks avoid, or only do in a limited fashion, because it's harder than it sounds.

Let's take one of the simplest transitions: a block of content that cross-fades between states.

To make this work, you need to have a phase where both the old and new content exist in the document at the same time. The old and new content will need to be in their correct viewport positions, which usually means they'll be overlaying each other, while maintaining layout with the rest of the page, so you'll probably need some form of wrapper to manage that. Another reason for the wrapper is to allow the two elements to [correctly cross-fade using `mix-blend-mode: plus-lighter`](https://jakearchibald.com/2021/dom-cross-fade/). Then, the old content will fade from `opacity: 1` to `opacity: 0`, while the new content fades from `opacity: 0` to `opacity: 1`. Once that's complete, the old content is removed, perhaps along with some of the wrapper(s) that were used just for the transition.

However, there are a number of accessibility and usability pitfalls in this simple example. The phase where both contents exist at the same time creates an opportunity for users of assistive technology to get confused between the two. The transition is a visual affordance, it shouldn't be seen by things like screen readers. There's also an opportunity for the user to interact with the old content in a way the developer didn't prevent (e.g. pressing buttons). The second DOM change after the transition, where the old content is removed, can create more accessibility issues, as the DOM mutation can cause an additional aria-live announcement of the same content. It's also a common place for focus state to get confused, particularly in frameworks where the new content DOM used in the transition may not be the same DOM used in the final state (depending on how virtual DOMs are diffed, it may not realize it's the same content, particularly if containers have changed).

If the content is large, such as the main content, the developer has to handle differences in the root scroll position between the two states. At the very least, one of the pieces of content will need to be offset to counteract the scroll difference between the two, and unset once the transition is complete.

And this is just a simple cross-fade. Things get an order of magnitude more complicated when page components need to transition position between the states. Folks have created [large complex plugins](https://greensock.com/docs/v3/Plugins/Flip/), built on top of even larger libraries, just to handle this small part of the problem. Even then, they don't handle cases where the element gets clipped by some parent, via `overflow: hidden` or similar. To overcome this, developers tend to pop the animating element out to the `<body>` so it can animate freely. To achieve that, the developer needs to alter their CSS so the element looks the same as a child of `<body>` as it does in its final place in the DOM. This discourages developers from using the cascade, and it plays badly with contextual styling features such as container queries.

If your site is an SPA, none of this is impossible, it's just _really hard_. With regular navigations (sometimes referred to as Multi-Page Apps, or MPAs), it is impossible.

The View Transitions feature follows the trend of transition APIs on platforms like [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle)
and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions), by allowing developers to continue to update page state atomically (either through DOM changes or cross-document navigations), while defining highly tailored transitions between the two states.

# MPA vs SPA solutions

The [current spec](https://drafts.csswg.org/css-view-element-transitions-1/) and experimental implementation in Chrome (behind the `chrome://flags/#document-transition` flag) focuses on SPA transitions. However, the model has also been designed to work with cross-document navigations. The specifics for cross-document navigations are covered [later in this document](#cross-document-same-origin-transitions).

This doesn't mean we consider the MPA solution less important. In fact, [developers have made it clear that it's more important](https://twitter.com/jaffathecake/status/1405573749911560196). We have focused on SPAs due to the ease of prototyping, so those APIs have had more development. However, the overall model has been designed to work for MPAs, with a slightly different API around it.

# Revisiting the cross-fade example

As described above, creating a cross-fade transition using existing platform features is more difficult than it sounds. Here's how to do it with View Transitions:

```js
function spaNavigate(data) {
  // Fallback for browsers that don't support this API:
  if (!document.startViewTransition) {
    updateTheDOMSomehow(data);
    return;
  }

  document.startViewTransition(() => updateTheDOMSomehow(data));
}
```

_(the API is described in detail in the next section)_

And now there's a cross-fade between the states:

https://user-images.githubusercontent.com/93594/185887048-53f3695a-104d-4f50-86cc-95ce61422678.mp4

Ok, a cross-fade isn't that impressive. Thankfully, transitions can be customized, but before we get to that, here's how this basic cross-fade worked:

# How the cross-fade worked

Taking the code sample from above:

```js
document.startViewTransition(() => updateTheDOMSomehow(data));
```

When `document.startViewTransition()` is called, the API captures the current state of the page. This includes taking a screenshot, which is async as it happens in the render steps of the event loop.

Once that's complete, the callback passed to `document.startViewTransition()` is called. That's where the developer changes the DOM.

Rendering is paused while this happens, so the user doesn't see a flash of the new content. Although, the render-pausing has an aggressive timeout.

Once the DOM is changed, the API captures the new state of the page, and constructs a pseudo-element tree like this:

```
::view-transition
└─ ::view-transition-group(root)
   └─ ::view-transition-image-pair(root)
      ├─ ::view-transition-old(root)
      └─ ::view-transition-new(root)
```

_(the specific function of each part of this tree, and their default styles, is covered [later in this document](#full-default-styles--animation))_

The `::view-transition` sits in a top-layer, over everything else on the page.

`::view-transition-old(root)` is a screenshot of the old state, and `::view-transition-new(root)` is a live representation of the new state. Both render as CSS replaced content.

The old image animates from `opacity: 1` to `opacity: 0`, while the new image animates from `opacity: 0` to `opacity: 1`, creating a cross-fade.

Once the animation is complete, the `::view-transition` is removed, revealing the final state underneath.

Behind the scenes, the DOM just changed, so there isn't a time where both the old and new content existed at the same time, avoiding the accessibility, usability, and layout issues.

The animation is performed using CSS animations, so it can be customized with CSS.

# Simple customization

All of the pseudo-elements above can be targeted with CSS, and since the animations are defined using CSS, you can modify them using existing CSS animation properties. For example:

```css
::view-transition-old(root),
::view-transition-new(root) {
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

::view-transition-old(root) {
  animation: 90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
    300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
}

::view-transition-new(root) {
  animation: 210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in,
    300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
}
```

And the result:

https://user-images.githubusercontent.com/93594/185893122-1f84ba5f-2c9d-46c6-9275-a278633f2e72.mp4

Note: In this example, the animation always moves from right to left, which doesn't feel natural when clicking the back button. How to change the animation depending on the direction of navigation is covered [later in the document](#customizing-the-transition-based-on-the-type-of-navigation).

# Transitioning multiple elements

In the previous demo, the whole page is involved in the shared axis transition. But that doesn't seem quite right for the heading, as it slides out just to slide back in again.

To solve this, View Transitions allow you to extract parts of the page to animate independently, by assigning them a `view-transition-name`:

```css
.header {
  view-transition-name: header;
  contain: layout;
}
.header-text {
  view-transition-name: header-text;
  contain: layout;
}
```

_Independently transitioning elements needs to have `layout` or `paint` containment, and avoid fragmentation, so the element can be captured as a single unit._

The page will now be captured in three parts: The header, the header text, and the remaining page (known as the 'root').

https://user-images.githubusercontent.com/93594/184097864-40b9c860-480a-45ff-9787-62cebe68a078.mp4

This results in the following pseudo-element tree for the transition:

```
::view-transition
├─ ::view-transition-group(root)
│  └─ ::view-transition-image-pair(root)
│     ├─ ::view-transition-old(root)
│     └─ ::view-transition-new(root)
│
├─ ::view-transition-group(header)
│  └─ ::view-transition-image-pair(header)
│     ├─ ::view-transition-old(header)
│     └─ ::view-transition-new(header)
│
└─ ::view-transition-group(header-text)
   └─ ::view-transition-image-pair(header-text)
      ├─ ::view-transition-old(header-text)
      └─ ::view-transition-new(header-text)
```

The new pseudo-elements follow the same pattern as the first, but for a subset of the page. For instance, `::view-transition-old(header-text)` is a 'screenshot' of the header text, and `::view-transition-new(header-text)` is a live representation of the new header text. Although, in this case, the header text images are identical, but the element has changed position.

Without any further customization, here's the result:

https://user-images.githubusercontent.com/93594/185895421-0131951f-c67b-4afc-97f8-44aa16cfbed7.mp4

Note how the top header remains static.

As well as the cross-fade between the old-image and the new-image, another default animation transforms the `::view-transition-group` from its before position to its after position, while also transitioning its width and height between the states. This causes the heading text to shift position between the states. Again, the developer can use CSS to customize this as they wish.

The high-level purpose of each pseudo-element:

- `::view-transition-group` - animates size and position between the two states.
- `::view-transition-image-pair` - provides blending isolation, so the two images can correctly cross-fade.
- `::view-transition-old` and `::view-transition-new` - the visual states to cross-fade.

The full default styles and animations of the pseudo-elements are covered [later in the document](#full-default-styles--animation).

# Transitioning elements don't need to be the same DOM element

In the previous examples, `view-transition-name` was used to create separate transition elements for the header, and the text in the header. These are conceptually the same element before and after the DOM change, but you can create transitions where that isn't the case.

For instance, the main video embed can be given a `view-transition-name`:

```css
.full-embed {
  view-transition-name: full-embed;
  contain: layout;
}
```

Then, when the thumbnail is clicked, it can be given the same `view-transition-name`, just for the duration of the transition:

```js
thumbnail.onclick = () => {
  thumbnail.style.viewTransitionName = "full-embed";

  document.startViewTransition(() => {
    thumbnail.style.viewTransitionName = "";
    updateTheDOMSomehow();
  });
};
```

And the result:

https://user-images.githubusercontent.com/93594/185897197-62e23bef-c198-4cd6-978e-c2e74892154b.mp4

The thumbnail now transitions into the main image. Even though they're conceptually (and literally) different elements, the transition API treats them as the same thing because they shared the same `view-transition-name`.

This is useful for cases like above where one element is 'turning into' another, but also for cases where a framework creates a new `Element` for something even though it hasn't really changed, due to a virtual DOM diffing mismatch.

Also, this model is _essential_ for MPA navigations, where all elements across the state-change will be different DOM elements.

# Transitioning elements don't need to exist in both states

It's valid for some transition elements to only exist on one side of the DOM change, such as a side-bar that doesn't exist on the old page, but exists in the new page.

For example, if an element only exists in the 'after' state, then it won't have a `::view-transition-old`, and its `::view-transition-group` won't animate by default, it'll start in its final position.

# Customizing the transition based on the type of navigation

In some cases, the elements captured, and the resulting animations, should be different depending on the source & target page, and also different depending on the direction of navigation.

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

In this example, the transition between the thumbnails page and the video page is significantly different to the transition between video pages. Also, animation directions are reversed when navigating back.

There isn't a specific feature for handling this. Developers can add class names to the document element, allowing them to write selectors that change which elements get a `view-transition-name`, and which animations should be used.

In particular, the [Navigation API](https://github.com/WICG/navigation-api) makes it easy to distinguish between a back vs forward traversal/navigation.

# Animating with JavaScript

The `ready` promise on `ViewTransition` returned by `document.startViewTransition()` fulfills when both states have been captured and the pseudo-element tree has been successfully built. This provides developers with a point where they can animate those pseudo-elements with the [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API).

For example, if the developer wanted to create a circular-reveal animation from the point of the last click:

```js
let lastClick;
addEventListener("click", (event) => (lastClick = event));

async function spaNavigate(data) {
  // Fallback for browsers that don't support this API:
  if (!document.startViewTransition) {
    updateTheDOMSomehow(data);
    return;
  }

  const transition = document.startViewTransition(() => {
    // Get the click position, or fallback to the middle of the screen
    const x = lastClick?.clientX ?? innerWidth / 2;
    const y = lastClick?.clientY ?? innerHeight / 2;
    // Get the distance to the furthest corner
    const endRadius = Math.sqrt(
      Math.max(x, innerWidth - x) ** 2 + Math.max(y, innerHeight - y) ** 2
    );

    updateTheDOMSomehow(data);
  });

  animateTransition(transition);

  // spaNavigate should resolve when the DOM updates,
  // not when the transition finishes.
  return transition.domUpdated;
}

async function animateTransition(transition) {
  await transition.ready;

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
      pseudoElement: "::view-transition-new(root)",
    }
  );

  return transition.finished;
}
```

And here's the result:

https://user-images.githubusercontent.com/93594/184120371-678f58b3-d1f9-465b-978f-ee5eab73d120.mp4

# Cross-document same-origin transitions

This section outlines the navigation specific aspects of the ViewTransition API. The rendering model for generating snapshots and displaying them using a tree of targetable pseudo-elements is the same for both SPA/MPA.

## Declarative opt-in to transitions

The first step is to add a new meta tag to the old and new Documents. This tag indicates that the author wants to enable transitions for same-origin navigations to/from this Document.

```html
<meta name="view-transition" content="same-origin">
```

The above is equivalent to the browser implicitly executing the following script in the SPA API:

```js
document.startViewTransition(() => updateDOMToNewPage());
```

This results in a cross-fade between the 2 Documents from the default CSS set up by the browser. The transition executes only if this tag is present on both the old and new Documents. The tag must also be added before the body element is parsed.

The motivation for a declarative opt-in, instead of a script event, is:

* Enabling authors to define transitions with no script. If the transition doesn't need to be customized based on the old/new URL, it can be defined completely in CSS.

* Avoiding undue latency in the critical path for browser initiated navigations like back/forward. We want to avoid dispatch of a script event for each of these navigations.

Issue: The meta tag can be used to opt-in to other navigation types going forward: same-document, same-site, etc.

Issue: This prevents the declaration being controlled by media queries, which feels important for `prefers-reduced-motion`.

## Script events

Script can be used to customize a transition based on the URL of the old/new Document; or the current state of the Document when the transition is initiated. The Document could've been updated since first lold from user interaction.

### Script on old document

```js
document.addEventListener("crossdocumentviewtransitionoldcapture", (event) => {
  // Cancel the transition (based on new URL) if needed.
  if (shouldNotTransition(event.toURL)) {
    event.preventDefault();
    return;
  }

  // Set up names on elements based on the new URL.
  if (shouldTagThumbnail(event.toURL)) {
    thumbnail.style.viewTransitionName = "full-embed";
  }

  // Add opaque contextual information to share with the new Document.
  // This must be [serializable object](https://developer.mozilla.org/en-US/docs/Glossary/Serializable_object).
  event.setInfo(createTransitionInfo(event.toURL));
});
```

### Script on new document

```js
// This event must be registered before the `body` element is parsed.
document.addEventListener("crossdocumentviewtransition", (event) => {
  // Cancel the transition (based on old URL) if needed.
  if (shouldNotTransition(event.fromURL)) {
    event.preventDefault();
    return;
  }

  // The `ViewTransitionNavigation` object associated with this transition.
  const transition = event.transition;

  // Retrieve the context provided by the old Document.
  const info = event.info;

  // Add render-blocking resources to delay the first paint and transition
  // start. This can be customized based on the old Document state when the
  // transition was initiated.
  markRenderBlockingResources(info);

  // The `ready` promise resolves when the pseudo-elements have been generated
  // and can be used to customize animations via script.
  transition.ready.then(() => {
    document.documentElement.animate(...,
       {
         // Specify which pseudo-element to animate
         pseudoElement: "::view-transition-new(root)",
       }
    );

    // Remove viewTransitionNames tied to this transition.
    thumbnail.style.viewTransitionName = "none";
  });
});
```

This provides the same scripting points as the SPA API, allowing developers to set class names to tailor the animation to a particular type of navigation.

Issue: Event names are verbose. Bikeshedding needed.

Issue: Do we need better timing for `crossdocumentviewtransition` event? Especially for Documents restored from BFCache.

Issue: Customizing which resources are render-blocking in `crossdocumentviewtransition` requires it to be dispatched before parsing `body`, or explicitly allow render-blocking resources to be added until this event is dispatched.

Issue: We'd likely need an API for the developer to control how much Document needs to be fetched/parsed before the transition starts.

Issue: The browser defers painting the new Document until all render-blocked resources have been fetched or timed out. Do we need an explicit hook for when this is done or could the developer rely on existing `load` events to detect this? This would allow authors to add viewTransitionNames based on what the new Document's first paint would look like.

Issue: Since `crossdocumentviewtransitionoldcapture` is dispatched after redirects and only if the final URL is same-origin, it allows the current Document to know whether the navigation eventually ended up on a cross-origin page. This likely doesn't matter since the site could know this after the navigation anyway but knowing on the current page before the navigation commits is new.

# Compatibility with existing developer tooling

Since this feature is built on existing concepts such as pseudo-elements and CSS animations, tooling for this feature should fit in with existing developer tooling.

In Chrome's experimental implementation, the pre-existing animation panel can be used to debug transitions, and the pseudo-elements are exposed in the elements panel.

https://user-images.githubusercontent.com/93594/184123157-f4b08032-3b4f-4ca3-8882-8bea0e944355.mp4

# Compatibility with frameworks

The DOM update can be async, to cater for frameworks that queue state updates behind microtasks. This is signaled by returning a promise from the `document.startViewTransition()` callback, which is easily achieved with an async function:

```js
document.startViewTransition(async () => {
  await updateTheDOMSomehow();
});
```

However, the pattern above assumes the developer is in charge of DOM updates, which isn't the case with most web frameworks. To assess the compatibility of this API with frameworks, the [demo site featured in this explainer](https://http203-playlist.netlify.app/) was built using Preact, and uses a [React-style hook](https://github.com/jakearchibald/http203-playlist/blob/main/src/shared/utils.ts#L53) to wrap the above API and make it usable with React/Preact.

As long as the framework provides a notification when the DOM is updated, which they already do to allow custom handling of elements, the transition API can be made to work with the framework.

# Error handling

This feature is built with the view that a transition is an enhancement to a DOM change. For example:

```js
document.startViewTransition(async () => {
  await updateTheDOMSomehow();
});
```

The API could discover an error before calling the `document.startViewTransition()` callback, meaning the transition cannot happen. For example, it may discover two elements with the same `view-transition-name`, or one of the transition elements is fragmented in a way that's incompatible with the API. In this case we still call the `document.startViewTransition()` callback, because the DOM change is more important than the transition, and being unable to create a transition is not a reason to prevent the DOM change.

However, if a transition cannot be created, the `ready promise on the returned `ViewTransition` will reject.

Error detection is also the reason why `document.startViewTransition()` takes a callback, rather than a model where the developer calls a method to signal when the DOM is changed:

```js
// Not the real API, just an alternative example:
const transition = new ViewTransition();
await transition.prepare();
await updateTheDOMSomehow();
transition.ready();
```

In a model like the one above, if `updateTheDOMSomehow()` throws, `transition.ready` would never be called, so the API would be in a state where it doesn't know if DOM change failed, or if it's just taking a long time. The callback pattern avoids this gotcha – we get to see the thrown error, and abandon the transition quickly.

The [Navigation API](https://wicg.github.io/navigation-api/#ref-for-dom-navigateevent-intercept%E2%91%A0%E2%91%A5) and [Web Locks API](https://w3c.github.io/web-locks/#ref-for-dom-lockmanager-request-name-options-callback%E2%91%A0) use this same pattern for the same reason.

# Handling ink overflow

Elements can paint outside of their border-box for a number of reasons, such as `box-shadow`.

The `::view-transition-old` and `::view-transition-new` will be the border box size of the original element, but the full ink overflow will be included in the image. This is achieved via [`object-view-box`](https://drafts.csswg.org/css-images-4/#propdef-object-view-box), which allows replaced elements to paint outside their bounds.

# Animating `width` and `height`

The `::view-transition-group` animates its `width` and `height` by default, which usually means the animations will run on the main thread.

However, `width` and `height` was deliberately chosen for developer convenience, as it plays well with things like `object-fit` and `object-position`.

https://user-images.githubusercontent.com/93594/184117389-3696400b-b381-478b-9837-888650c6d217.mp4

In this example, a 4:3 thumbnail transitions into a 16:9 main image. This is [relatively easy](https://developer.chrome.com/blog/shared-element-transitions-for-spas/#handling-changes-in-aspect-ratio) with `object-fit`, but would be complex using only transforms.

Due to the simple nature of these pseudo-element trees, these animations should be able to run off the main thread. However, if the developer adds something that requires layout, such as a border, the animation will fall back to main thread.

# Full default styles & animation

## `::view-transition`

Default styles:

```css
::view-transition {
  // Aligns this element with the "snapshot viewport". This is the viewport when all retractable
  // UI (like URL bar, root scrollbar, virtual keyboard) are hidden.
  position: fixed;
  top: -10px;
  left: -15px;
}
```

## `::view-transition-group(*)`

Default styles:

```css
::view-transition-group(*) {
  /*= Styles for every instance =*/
  position: absolute;
  top: 0px;
  left: 0px;
  will-change: transform;
  pointer-events: auto;

  /*= Styles generated per instance =*/

  /* Dimensions of the new element */
  width: 665px;
  height: 54px;

  /* A transform that places it in the viewport position of the new element. */
  transform: matrix(1, 0, 0, 1, 0, 0);

  writing-mode: horizontal-tb;
  animation: 0.25s ease 0s 1 normal both running
    page-transition-group-anim-main-header;
}
```

Default animation:

```css
@keyframes page-transition-group-anim-main-header {
  from {
    /* Dimensions of the old element */
    width: 600px;
    height: 40px;

    /* A transform that places it in the viewport position of the old element. */
    transform: matrix(2, 0, 0, 2, 0, 0);
  }
}
```

## `::view-transition-image-pair(*)`

Default styles:

```css
::view-transition-image-pair(*) {
  /*= Styles for every instance =*/
  position: absolute;
  inset: 0px;

  /*= Styles generated per instance =*/
  /* Set if there's an old and new image, to aid with cross-fading.
     This is done conditionally as isolation has a performance cost. */
  isolation: isolate;
}
```

Default animation: none.

## `::view-transition-old(*)`

This is a replaced element displaying the capture of the old element, with a natural aspect ratio of the old element.

```css
::view-transition-old(*) {
  /*= Styles for every instance =*/
  position: absolute;
  inset-block-start: 0px;
  inline-size: 100%;
  block-size: auto;
  will-change: opacity;

  /*= Styles generated per instance =*/

  /* Set if there's an old and new image, to aid with cross-fading.
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

## `::view-transition-new(*)`

```css
@keyframes page-transition-fade-in {
  to {
    opacity: 0;
  }
}
```

# Future work

There are parts to this feature that we're actively thinking about, but aren't fully designed.

## Nested transition containers

In the current design, each `::view-transition-group` is a child of the `::view-transition`. This works really well in most cases, but not all:

https://user-images.githubusercontent.com/93594/184126476-83e2dbc7-ba26-4135-9d16-c498311f2359.mp4

The element moving from one container to the other benefits from the flat arrangement of `::view-transition-group`s, as it doesn't get clipped by the parent. However, the elements that remain in the container _do_ benefit from the clipping provided by the parent.

The rough plan is to allow nesting via an opt-in (all API names used here are for entertainment purposes only):

```css
.container {
  view-transition-name: container;
  contain: paint;
}
.child-item {
  view-transition-name: child-item;
  contain: layout;
  page-transition-style-or-whatever: nested;
}
```

With this opt in, rather than the containers being siblings:

```
::view-transition
├─ …
├─ ::view-transition-group(container)
│  └─ ::view-transition-image-pair(container)
│     └─ …
└─ ::view-transition-group(child-item)
   └─ ::view-transition-image-pair(child-item)
      └─ …
```

…the `child-item` would be nested in its closest parent that's also a transition element:

```
::view-transition
├─ …
└─ ::view-transition-group(container)
   ├─ ::view-transition-image-pair(container)
   │  └─ …
   └─ ::view-transition-group(child-item)
      └─ ::view-transition-image-pair(child-item)
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
::view-transition-group(foo)::image-wrapper::old-image {
  /* … */
}
```

We have proposed a new combinator to make it easier to select descendant pseudo elements https://github.com/w3c/csswg-drafts/issues/7346.

```css
::view-transition-group(foo) :>> old-image {
  /* … */
}
```

This will play well with CSS nesting:

```css
::view-transition-group(foo) {
  & :>> old-image {
    /* … */
  }
  & :>> new-image {
    /* … */
  }
}
```

## Transitions targeted to a specific element

In the current design, the transition acts across the whole document. However, developers have expressed interest in using this system, but limited to a single element. For example, allowing two independent components to perform transitions.

This is being discussed in https://github.com/WICG/view-transitions/issues/52 and a rough proposal is [here](https://github.com/WICG/view-transitions/blob/main/scoped-transitions.md).

# Security/Privacy considerations

The security considerations below cover same-origin transitions.

- Script can never read pixel content in the images. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
- If an element is captured as a 'computed style + content image', any external resources specified on the container, such as background images, will be re-fetched in the context of the new page to account for differences in sandboxing.

Cross-origin transitions aren't yet defined, but are likely to be heavily restricted.

# Interactivity and accessibility

- Page transitions are a purely visual affordance. In terms of interactivity, transition elements will behave like `div`s regardless of the original element. Developers could break this intent by adding interactivity directly to the transition element, e.g. by deliberately adding a `tabindex` attribute. But this isn't recommended.
- The page transition stage will be hidden from assistive technologies such as screen readers.
- The duration for which DOM rendering is suppressed, to allow an author to asynchronously switch to the new DOM, input processing is also paused. This is necessary since the visual state presented to the user is inconsistent with the DOM state used for hit-testing.
