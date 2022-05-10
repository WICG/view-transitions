# Developer guide

This guide covers the page transition API as currently supported in [Chrome Canary](https://www.google.com/chrome/canary/), for developers who want to try out the feature today. The [explainer](./explainer.md) is a more in-depth overview of the feature, but it includes parts that aren't implemented yet.

## Flags

This feature requires the `chrome://flags/#document-transition` flag.

## Demo

[Here's a demo](https://http203-playlist.netlify.app/) that uses many of the techniques in this guide.

In addition to the `chrome://flags/#document-transition` flag, the demo also requires `chrome://flags/#enable-experimental-web-platform-features` to enable navigation API.

## Performing a basic page transition

This API will support cross-document navigations (sometimes called 'MPA') in future, but right now only same-document (or SPA) navigations are supported.

Here's how to create a basic transition:

```js
async function spaNavigate(data) {
  // Fallback
  if (!document.createDocumentTransition) {
    await updateDOMForPage(data);
    return;
  }

  // With a transition
  const transition = document.createDocumentTransition();
  await transition.start(() => updateDOMForPage(data));
  console.log("Transition complete!");
}
```

Where `updateTheDOMSomehow` is a function you'd write to switch the DOM from the current state to the new state.

Once you've done this, you should see a quick fade from one state to another.

### How did this work?

Here's what happened at each stage in the process:

```js
async function spaNavigate(data) {
  // Fallback
  if (!document.createDocumentTransition) {
    await updateDOMForPage(data);
    return;
  }

  // With a transition
  const transition = document.createDocumentTransition();
  await transition.start(async () => {
    // Once this callback has called, the browser has captured the page similar to a screenshot.
    // This screenshot is now being displayed rather than the real DOM.
    // Any animated content on the page (e.g. CSS animations, videos, GIFs) will now appear frozen.
    await updateTheDOMSomehow();
    // The DOM has now updated, but the user is still looking at the screenshotted state.
    // Once this async function returns, the transition will begin.
  });
  // The transition is now complete, and the screenshotted state is removed to reveal
  // the real DOM underneath.
}
```

The default transition is a cross-fade from the screenshotted state to the new state.

The 'screenshot' is actually a DOM structure created out of pseudo-elements that sits in a special top-layer:

```html
<special-top-layer>
  <container(root)>
    <image-wrapper(root)>
      <outgoing-image(root) />
      <incoming-image(root) />
    </image-wrapper(root)>
  </container(root)>
</special-top-layer>
```

The `outgoing-image` and `incoming-image` represent the visual outgoing and incoming states, and they render as CSS 'replaced content' (like an `<img>`). The outgoing-image animates from `opacity: 1` to `opacity: 0`, whereas the incoming-image animates from `opacity: 0` to `opacity: 1`, creating a cross-fade.

### Customizing the transition

The animation is driven by CSS animations, so they can be overridden with CSS. Each of the pseudo-elements can be targeted using CSS pseudo-element selectors:

- `container(root)` - `::page-transition-container(root)`
- `image-wrapper(root)` - `::page-transition-image-wrapper(root)`
- `outgoing-image(root)` - `::page-transition-outgoing-image(root)`
- `incoming-image(root)` - `::page-transition-incoming-image(root)`

So, you can create a really slow cross-fade like this:

```css
::page-transition-outgoing-image(root),
::page-transition-incoming-image(root) {
  animation-duration: 5s;
}
```

Or, instead of a cross-fade, you could redefine the animation completely. Here's how you'd make old state slide out, and the new state slide in:

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

In order to make a [true cross-fade](https://jakearchibald.com/2021/dom-cross-fade/), the `::page-transition-image-wrapper` has a `mix-blend-mode` of `plus-lighter`. If you don't want the outgoing & incoming states to cross-fade, and you want them to overlap each other, you'll need to set the `mix-blend-mode` back to normal. For example, here's a transition where the outgoing image slides away to reveal the incoming image beneath:

```css
@keyframes slide-to-left {
  to {
    transform: translateX(-100%);
  }
}

::page-transition-outgoing-image(root) {
  /* Put the outgoing image on top */
  z-index: 1;
  /* Slide it away */
  animation: 500ms ease-out both slide-to-left;
}

::page-transition-incoming-image(root) {
  /* Prevent the default animation */
  animation: none;
}

::page-transition-image-wrapper(root) {
  /* To allow the images to sit on top of each other,
  use a normal blend mode: */
  mix-blend-mode: normal;
}
```

## Async DOM updates

```js
const transition = document.createDocumentTransition();
await transition.start(callback);
console.log("Transition complete!");
```

The API supports asynchronous DOM updates, which are common in most frameworks. To make this work, `callback` should return a promise that resolves once the DOM update is complete. However, remember that the user is left with a non-interactive screenshot between `callback` being called and its promise resolving, so this should happen as fast as position. Specifically, avoid things like network activity – do those before creating the transition, like this:

```js
async function spaNavigate(path) {
  const data = await fetchDataForPage(path);

  if (!document.createDocumentTransition) {
    await updateDOMForPage(data);
    return;
  }

  const transition = document.createDocumentTransition();
  await transition.start(() => updateDOMForPage(data));
}
```

## Transitioning multiple elements

So far, we've been animating the whole page, but state transitions often need to animate things independently. To do this, you can use the `page-transition-tag` CSS property.

If you wanted the site header of your site to stay still during the slide transition above:

```css
.site-header {
  page-transition-tag: side-header;
  /* Paint containment is required */
  contain: paint;
}
```

This changes how the page is captured. When `transition.start(callback)` is called:

1. For every rendered element that has a `page-transition-tag`:
   1. Extract it from the page, and create a `::page-transition-container` for it, adding in a `::page-transition-outgoing-image`.
1. Do the same for the remainder of the page.
1. Call `callback`, and wait for its returned promise to resolve.
1. For every rendered element that has a `page-transition-tag`:
   1. Extract it from the page.
   1. If there's already a `::page-transition-container` for a `page-transition-tag` of this name, use it, otherwise create a new one.
   1. Adding in a `::page-transition-incoming-image`.

If our header exists on both sides of the DOM change, we'll now have a structure like this:

```html
<special-top-layer>
  <container(root)>
    <image-wrapper(root)>
      <outgoing-image(root) />
      <incoming-image(root) />
    </image-wrapper(root)>
  </container(root)>

  <container(site-header)>
    <image-wrapper(site-header)>
      <outgoing-image(site-header) />
      <incoming-image(site-header) />
    </image-wrapper(site-header)>
  </container(site-header)>
</special-top-layer>
```

Although, it's possible to have one of these structures that doesn't have an incoming/outgoing image. For example, if the element was only there before the DOM change, or only there after the DOM change.

In a similar way that we were using `::page-transition-outgoing-image(root)` to target the outgoing image of the root, we can use `::page-transition-outgoing-image(site-header)` to target the outgoing image of the site-header, and animate it separately.

The default animation animates the `width` and `height` of the `::page-transition-container` from its before size to its after size, while animating a `transform` to move it from its before position to its after position. If the header is unchanged, it'll appear fixed in place while the rest of the content (the root) slides as we specified earlier.

### Flat transition structures

Each captured element, along with the root, will be a direct child of the special top layer. This means you can move elements between containers, even if they have `overflow: hidden` or some other form of clipping in the real DOM.

We plan to add a feature to allow one transition container to be nested within another, but that isn't currently implemented.

## Animation synchronization gotcha

Right now, there's a delay between Chrome creating the outgoing image element, and the incoming image element. That means the styles for the outgoing image element will apply sooner, which in turn means its animation will start sooner, and apply out of sync with the incoming image element.

This is considered a bug (well, a design error), but you can work around it:

```js
async function spaNavigate(data) {
  // Fallback
  if (!document.createDocumentTransition) {
    await updateDOMForPage(data);
    return;
  }

  // With a transition
  const transition = document.createDocumentTransition();

  // Add a temporary class:
  document.documentElement.classList.add("transition-warming-up");

  await transition.start(async () => {
    await updateDOMForPage(data);

    // Now remove it:
    document.documentElement.classList.remove("transition-warming-up");
  });
}
```

Then in the CSS:

```css
.transition-warming-up::page-transition-container(*),
.transition-warming-up::page-transition-incoming-image(*),
.transition-warming-up::page-transition-outgoing-image(*) {
  animation-play-state: paused !important;
}
```

This pauses the animations until both the outgoing and incoming content is ready.

## Using `object-fit` and `object-position`

The default animation animates the `width` and `height` of the `::page-transition-container`, which is generally frowned upon in web performance circles, as it runs layout per frame. However, for page transitions, we plan to optimize it so it isn't an issue (it isn't optimized yet).

To benefit of this, is `object-fit` and `object-position` become really useful.

Let's say you're animating a 4:3 thumbnail of an image to a 16:9 full version:

```css
::page-transition-image-wrapper(lightbox-image) {
  /* We aren't going to cross-fade the image */
  mix-blend-mode: normal;
}

::page-transition-outgoing-image(lightbox-image) {
  /* Put the outgoing component on top */
  z-index: 1;
  /* As the container transitions from 4:3 to 16:9, keep the outgoing image in the center,
  revealing blank space on the sides. */
  object-fit: contain;
}

::page-transition-incoming-image(lightbox-image) {
  /* Don't fade the image in, allow it to be shown straight away, but under
  the outgoing image (the outgoing image will quickly fade out) */
  animation: none;
  /* As the container transitions from 4:3 to 16:9, gradually un-crop the image. */
  object-fit: cover;
}
```

## Different transitions depending on the source and destination

Sometimes a page transition can be custom between particular states. Currently, the best way to achieve this is to add a temporary class to the HTML element:

```js
async function spaNavigate(fromPath, toPath) {
  const data = await fetchDataForPage(toPath);

  if (!document.createDocumentTransition) {
    await updateDOMForPage(data);
    return;
  }

  if (fromPath === "/" && toPath === "/video/") {
    document.documentElement.classList.add("transition-from-home-to-video");
  }

  const transition = document.createDocumentTransition();
  await transition.start(() => updateDOMForPage(data));

  document.documentElement.classList.remove("transition-from-home-to-video");
}
```

Now you can use that class in your CSS:

```css
.transition-from-home-to-video .site-header {
  /* Only make the header its own container in the transition if the transition
  is from home-to-video: */
  page-transition-tag: site-header;
  contain: paint;
}

.transition-from-home-to-video::page-transition-outgoing(root) {
  /* Customize the animation of the root if the transition is from
  home-to-video: */
}
```

Alternatively, you can dynamically set `el.style.pageTransitionTag` with JavaScript.

## Debugging

First, the bad news: the DOM structures aren't currently visible in the elements panel. Yeah. I know. We're working on it.

But, the good news is the [animation panel](https://developer.chrome.com/docs/devtools/css/animations/) is really useful here. You can start transition animations in a paused state, then scrub back and forth through them!
