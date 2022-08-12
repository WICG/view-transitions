# Introduction

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

Page transitions not only look great, they also communicate direction of flow, and make it clear which elements are related from page to page. They can even happen during data fetching, leading to a faster perception of performance.

On Single Page Apps (SPAs) developers can use animation tools such as [CSS transitions](https://developer.mozilla.org/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions), [CSS animations](https://developer.mozilla.org/docs/Web/CSS/CSS_Animations/Using_CSS_animations), and the [Web Animation API](https://developer.mozilla.org/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API) to create transitions. However, it's not straight forward, mostly due to the period where both states need to exist in the DOM at the same time, so both can be partially visible (eg in a cross-fade). This creates issues with:

- **Accessibility**: Having both states in the DOM at the same time can create a confusing experience for screen reader users. Juggling the DOM around for the sake of a transition doesn't play well with things like ARIA live regions.
- **Usability**: The old DOM will continue to exist during the transition, leading to complications if the user manages to interact with that content (eg clicking buttons).
- **Scroll handling**: If the root scroll position is different between the states, then the old/new content needs to be offset to compensate. This is a source of bugs in transition frameworks.
- **CSS structure**: If, during the transition, one element transitions between containers, clipping such as `overflow: hidden` can get in the way. To work around this, developers tend to pop the element out to the `<body>` for the duration of the transition to avoid the clipping. This not only presents more accessibility issues, it also forces the developer to structure their CSS in a particular way, so the element retains the correct styling outside of its usual container.

And of course, for regular cross-document navigations, creating a transition is currently impossible.

The Shared Element Transition follows the trend of transition APIs on platforms like [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle)
and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions), by allowing developers to continue to update page state atomically (either through DOM changes or cross-document navigations), while defining highly tailored transitions between the two states.

The [current spec](https://tabatkins.github.io/specs/css-shared-element-transitions/) and experimental implementation focuses on SPA transitions, although the model has been designed to also work with cross-document navigations. The specifics for cross-document navigations are covered later in this document.

# Preparing a transition

In order to create a transition, the feature needs to capture the state of the page before and after the change. For SPA transitions, this is done via a JavaScript API:

```js
const transition = new SameDocumentTransition();
await transition.prepare(async () => {
  await updateTheDOMSomehow();
});
```

_This is the latest API design, which hasn't yet been implemented in Chrome Canary, so the code samples here will differ from those in the [developer guide](https://developer.chrome.com/blog/shared-element-transitions-for-spas/)._

The developer also signals which parts of the page they wish to animate independently, by assigning elements a unique `page-transition-tag`:

```css
.whatever {
  page-transition-tag: whatever;
  contain: layout;
}
```

_Independently transitioning elements needs to have `layout` or `paint` containment, and not-allow fragmentation, so the element can be captured as a single unit._

The callback passed to `prepare()` is called once the browser has captured the current state (at the end of the [next render steps](https://tabatkins.github.io/specs/css-shared-element-transitions/#ref-for-update-the-rendering)). At this point rendering is paused, so the developer can make the DOM change without the user seeing a flash of the new content. Once the promise returned by the `prepare()` callback fulfills, the browser captures the new state.

The `prepare()` callback allows for the DOM change to be async, as many frameworks batch "please change this state" requests. Due to the render blocking during this phase, browsers will have an aggressive timeout. Developers shouldn't use this to block rendering while fetching view data - this should be done before calling `prepare()`.

## The captured state

Assuming a page's header, and the text within that header, are to be animated independently:

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

The page will be captured in three parts: The header, the header text, and the remaining page (known as the 'root').

https://user-images.githubusercontent.com/93594/184097864-40b9c860-480a-45ff-9787-62cebe68a078.mp4

_The above shows the parts of the page captured before and after the DOM change._

For the outgoing state, the following is captured for each part:

- An image of the element, including ink overflow if any. The browser may crop this to make efficient use of memory, and that cropping should be biased towards the viewport. This image also excludes painting of any descendants with a page-transition-tag, as if they have `visibility: hidden`.
- The layout dimensions.
- A CSS transform that would place element from the layout viewport origin to its current quad.
- An [`object-view-box`](https://drafts.csswg.org/css-images-4/#propdef-object-view-box) that coincides with the element's border box.

The above is also captured for the incoming state, although the image and computed layout properties of the element are 'live', as in it's connected to the representation currently in the DOM.

It's valid for some transition elements to only exist on one side of the DOM change.

## Building the pseudo-element tree

For each transitioning element (including the root), the following pseudo-element tree is created:

```
::page-transition-container(name)
└─ ::page-transition-image-wrapper(name)
   ├─ ::page-transition-outgoing-image(name)
   └─ ::page-transition-incoming-image(name)
```

Where `name` is the `page-transition-tag` value, which is `root` for the root. If the transitioning element only existed on one side of the DOM change, then either the outgoing or incoming image will be missing.

These trees are inserted into a `::page-transition` pseudo element, according to the paint order of their transition elements.

The `::page-transition` is rendered in a top-level stacking context, filling the viewport.

Once this is in place, rendering is resumed.

# Default styles & animation

## `::page-transition-container(*)`

Default styles:

- Absolutely positioned to the top left of the parent.
- Width and height of the outgoing element.
- A transform that places it in the viewport position of the outgoing element.

Default animation:

- Width and height animates to the dimensions of the incoming element.
- Transform animates to a transform that places it in the viewport position of the incoming element.

## `::page-transition-image-wrapper(*)`

Default styles:

- Absolutely positioned with 0 inset.
- `isolation: isolate` to aid with cross-fading.

Default animation: none.

## `::page-transition-outgoing-image(*)`

Default styles:

- A replaced element displaying the capture of the outgoing element, with a natural aspect ratio of the outgoing element.
- Absolutely positioned to the inline & block start.
- `mix-blend-mode: plus-lighter` to allow for a true cross-fade.
- 100% block size
- Auto inline size
- The captured `object-view-box`

The `object-view-box` allows the image to be the layout size of the element, but allow overflow (to accommodate ink-overflow) and underflow (cropping to save memory) in the image data.

Default animation:

- Opacity animates from 1 to 0.

Note that the height of this element is auto, so it won't stretch the image as the container changes height. The developer can change this if they wish.

## `::page-transition-incoming-image(*)`

As above, but animates from opacity 0 to 1.

# Ending the transition

The transition ends once a state is reached where no animations are running on any of the transition pseuduo-elements.

Once this happens, the pseudo-elements are removed, and the real DOM underneath is shown.

# Customization of animation

The default animation cross-fades the element's visual representation, while transitioning their size and position. This is all driven by CSS animations, so the developer can easily override them.

All of the pseudo-elements are accessible from the root element. For instance:

```css
::page-transition-outgoing-image(*),
::page-transition-incoming-image(*) {
  animation-duration: 5s;
}
```

…this would make all the cross-fades 5s in duration. Whereas a more practical customization:

```css
@keyframes slide-to-left {
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-from-right {
  from {
    transform: translateX(100%);
  }
}

::page-transition-outgoing-image(root) {
  animation: 500ms ease-out both slide-to-left;
}

::page-transition-incoming-image(root) {
  animation: 500ms ease-out both slide-from-right;
}
```

…results in this:

https://user-images.githubusercontent.com/93594/184115192-db324e58-d6c6-42cf-9d01-74db1a7ea15c.mp4

In this case, only the root animation is customized. The header and header text are performing their default animations.

# Dynamic tagging

Since `page-transition-tag` is used to identify which elements should transition independently, those elements can differ depending on things like media queries.

Also, the `page-transition-tag` can be assigned via JavaScript in response to how the navigation was initiated.

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

In this example, the clicked thumbnail and the larger embed are given the same `page-transition-tag`. Even though these elements are quite different in the DOM, having the same `page-transition-tag` on each side of the DOM change means the transition API treats them as the same transitioning element. As a result, the thumbnail 'grows' into the main video embed.

# Animating `width` and `height`

The default animations include animating `width` and `height`, which usually means the animations will run on the main thread, and may jank.

However, `width` and `height` was deliberately chosen for developer convenience, as it plays well with things like `object-fit` and `object-position`.

https://user-images.githubusercontent.com/93594/184117389-3696400b-b381-478b-9837-888650c6d217.mp4

In this example, a 4:3 thumbnail transitions into a 16:9 main image. This is [relatively easy](https://developer.chrome.com/blog/shared-element-transitions-for-spas/#handling-changes-in-aspect-ratio) with `object-fit`, but would be complex using only transforms.

Due to the simple nature of these pseudo-element trees, these animations should be able to run off the main thread. However, if the developer adds something that requires layout, such as a border, the animation will fall back to main thread.

# Compatibility with frameworks

```js
const transition = new SameDocumentTransition();
await transition.prepare(async () => {
  await updateTheDOMSomehow();
});
```

This pattern assumes the developer is in charge of DOM updates, but that isn't the case with most web frameworks. However, the [demo site featured in this explainer](https://http203-playlist.netlify.app/) was built using Preact, and uses a [React-style hook](https://github.com/jakearchibald/http203-playlist/blob/main/src/client/utils.ts#L11) to wrap the above API and make it usable with React/Preact.

As long as the framework provides a notification when the DOM is updated, which they already do to allow custom handling of elements, the transition API can be made to work with the framework.

# Animating with JavaScript

The promise returned by `prepare()` fulfills when both states have been captured and the pseudo-element tree has been successfully built. This provides developers with a point where they can animate those pseudo-elements with the [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API).

https://user-images.githubusercontent.com/93594/184120371-678f58b3-d1f9-465b-978f-ee5eab73d120.mp4

This example animates a circular `clip-path` from the position of the click to a size that covers the viewport. Since this isn't possible with CSS alone ([although it may get easier in future](https://github.com/w3c/csswg-drafts/issues/824#issuecomment-1204467456)), the Web Animation API is used.

# Customizing the transition based on the type of navigation

In some cases, the elements captured, and the resulting animations, should be different depending on the source & target page, and also different depending on the direction of navigation.

https://user-images.githubusercontent.com/93594/184085118-65b33a92-272a-49f4-b3d6-50a8b8313567.mp4

In this example, the transition between the thumbnails page and the video page is significantly different to the transition between video pages. Also, animation directions are reversed when navigating back.

There isn't a specific feature for handling this. Developers can add class names to the document element, allowing them to write selectors that change which elements get a `page-transition-tag`, and which animations should be used.

In particular, the [Navigation API](https://github.com/WICG/navigation-api) makes it easy to distinguish between a back vs forward traversal/navigation.

# Error handling

This feature is built with the view that a transition is an enhancement to a DOM change. For example:

```js
const transition = new SameDocumentTransition();
await transition.prepare(async () => {
  await updateTheDOMSomehow();
});
```

The API could discover an error before calling the `prepare()` callback, meaning the transition cannot happen. For example, it may discover two elements with the same `page-transition-tag`, or one of the transition elements is fragmented in a way that's incompatible with the API. In this case we still call the `prepare()` callback, because the DOM change is more important than the transition, and being unable to create a transition is not a reason to prevent the DOM change.

However, if a transition cannot be created, the promise returned by `prepare()` will reject.

# Developer tooling

Since this feature is built on existing concepts such as pseudo-elements and CSS animations, tooling for this feature should fit in with existing developer tooling.

In Chrome's experimental implementation, the pre-existing animation panel could be used to debug transitions, and the pseudo-elements were exposed in the elements panel.

https://user-images.githubusercontent.com/93594/184123157-f4b08032-3b4f-4ca3-8882-8bea0e944355.mp4

# Future work

There are elements to this feature that we're actively thinking about, but aren't fully designed.

## Cross-document same-origin transitions

Many developers are more excited about cross-document transitions than SPA transition. We've focused on SPA transitions as it's a slightly smaller problem, and easier to prototype. However, the model has been designed to work across documents.

In the SPA API:

```js
const transition = new SameDocumentTransition();
await transition.prepare(async () => {
  await updateTheDOMSomehow();
});
```

`prepare()` is used to signal that the current state should be captured, and the promise returned by the promise signals when the new state can be captured, and the transition can begin. Making cross-document transitions work means replacing those moments with moments either side of a cross-document navigation.

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

The element moving from one container to the other benefits from the flat arrangement of `::page-transition-container`, as it doesn't get clipped by the parent. However, the elements that remain in the container _do_ benefit from the clipping provided by the parent.

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

# Security/Privacy Considerations

The security considerations below cover same-origin transitions.

- Script can never read pixel content in the images. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
- If an element is captured as a 'computed style + content image', any external resources specified on the container, such as background images, will be re-fetched in the context of the new page to account for differences in sandboxing.

Cross-origin transitions aren't yet defined, but are likely to be heavily restricted.

# Interactivity and accessibility

Page transitions are a purely visual affordance. In terms of interactivity, transition elements will behave like `div`s regardless of the original element.

Developers could break this intent by adding interactivity directly to the transition element, e.g. by deliberately adding a `tabindex` attribute. But this isn't recommended.

The page transition stage will be hidden from assistive technologies such as screen readers.
