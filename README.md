# Shared Element Transitions

Shared Element Transitions is a proposal for a new script API that allows a
simple set of transitions in both Single-Page Applications (SPAs) and
Multi-Page Applications (MPAs).

The inspiration for this feature are transitions similar to the ones listed in
the [Material Design Principles](https://material.io/design/motion/the-motion-system.html).

The intent is to support transitions similar to
[Android Activity Transitions](https://developer.android.com/training/transitions/start-activity).

### Root Transitions

The proposal can be split into two parts: a root transition, and a shared
element transition.  As an example of a root transition, consider the following
snippet of code:

```js
function changeBodyBackground() {
  document.body.style = "background: blue";
}

function handleTransition() {
  document.documentTransition.prepare({
    rootTransition: "reveal-left",
    duration: 300
  }).then(() => {
    changeBodyBackground();
    document.documentTransition.start().then(() => console.log("transition finished"));
  });
}
```

If script simply calls `changeBodyBackground()`, then the `body` element's
background will change to blue. The change will appear on the next visual
frame. However, if script calls `handleTransition()`, then the following steps
happen:

* We prepare a documentTransition object with a "reveal-left" root transition,
  and a 300ms transition duration.
* The process of 'preparing' asynchronously saves a copy of the pixels
  currently present on the screen. When saving is done, the promise resolves.
* After the promise resolves, we call `changeBodyBackground()`, which changes
  the `body` element's background to blue, and start the document transition.
* Because the effect specified is "reveal-left", the saved pixels slide to the
  left, revealing the new blue background body on the page. The similar effect
  is possible regardless of the complexity of the page or the DOM changes
  associated with the transition.

Note that to accomplish a similar effect as a polyfill, the script would need
to make a copy of the whole page, or draw to canvas, in order to have seemingly
two copies of the DOM. One copy would slide and another one be revealed with
some changes.

Below is a video of some of the sample transitions:

[![Video Link for Root Element Transitions](https://img.youtube.com/vi/0a_cOCatKXM/0.jpg)](https://www.youtube.com/watch?v=0a_cOCatKXM)

A similar effect could be achieved in the MPA case, although the API is likely
to differ slightly.

#### Supported Effects

The following is a list of effects that could be supported for root
transitions. Note that this list is not comprehensive.

* `reveal-left`: old content slides from center in the specified direction,
  revealing new content.
* `reveal-right`
* `reveal-up`
* `reveal-down`
* `cover-left`: new content slides from an edge in the specified direction,
  covering old content.
* `cover-right`
* `cover-up`
* `cover-down`
* `explode`: old content "explodes" by growing and becoming more transparent,
  revealing new content.
* `implode`: new content "implodes" by shrinking from a large side and becoming
  opaque, convering old content.

### Shared Element Transitions

Note that if a set of shared elements could be specified, then the User-Agent
could also transition the shared elements independently on the root transition.
See also [Android Activity Transitions](https://developer.android.com/training/transitions/start-activity)
for a use of this concept in that platform. The effect would be that the shared
elements go from the old location to the new location _while_ root transition takes place.

The above example API may change to include a sequence of elements that need to
be shared, both in the `prepare` and the `start` phases:

```js
function handleTransition() {
  document.documentTransition.prepare({
    rootTransition: "reveal-left",
    duration: 300,
    sharedElements: [e1, e2, e3]
  }).then(() => {
    changeBodyBackground();
    document.documentTransition.start({ sharedElements: [newE1, newE2, newE3] }).then(
      () => console.log("transition finished"));
  });
}
```

This means that the elements specified in the prepare call automatically
transition to the location and place of elements corresponding elements
specified in the start call.

Below is an example that utilizes both shared and root element transitions to
achieve the effect.

[![Video Link for Shared Element Transitions](https://img.youtube.com/vi/K7oVrXlVsgE/0.jpg)](https://www.youtube.com/watch?v=K7oVrXlVsgE)

## Multi-page support

With some work, the above effects can be achieved with existing animation
frameworks. In other words, since all of the effects occur on Single-Page Apps,
the page has full control of where the contents are at any given time. This
means that although it may be a lot of work, the effects are possible.

We want to extend the documentTransition API to work with Multi-Page Apps as
well. This means that the same effects would be achieved across page
navigations. This is not something that is currently possible, since neither
the source nor the destination pages can access and blend pixel content from
both pages.

The API shape is being discussed on [this issue](https://github.com/vmpstr/shared-element-transitions/issues/2).

Part of the API remains the same: we need to prepare a frame before the
animation can start. When the page is prepared, we can begin the animation with
a call to

```js
document.documentTransition.startOnNavigation(
  url,
  sharedElements: selectorList
);
```

This call will initiate a navigation with a prepared effect.

Note that because the page initiating the navigation does not have access to
the elements of the destination page, we instead have to provide a list of
selectors. The format of the selectors is still under active discussion. We
will update this page when we have built consensus.

## Status

The SPA part of the API is available to test in Chrome Canary. 

It can be enabled by toggling the documentTransition API in
[about:flags](chrome://flags/#document-transition)

### Known limitations

The following is a list of known limitations of the API.

* For now, the API only works with Single-Page Apps.
* Currently only the outermost document transitions are supported. This means
  that local iframes in particular would not work as expected.

Note that these are not limitations of the API, but rather limitations of our
current implementation. We are working on improving our implementation.

## Previous Efforts

There have been prior efforts in this space, ranging from APIs proposed for the
web platform to effects like IE5 transition effects that were removed. We
believe that the current proposal aligns web development with native mobile
development by bringing similar transition capabilities to the web platform.

* [Navigation Transition Design](https://docs.google.com/document/d/17jg1RRL3RI969cLwbKBIcoGDsPwqaEdBxafGNYGwiY4/edit?pli=1#heading=h.tdzcka62qyfo) ([intent to implement](https://groups.google.com/a/chromium.org/forum/#!searchin/blink-dev/intent$20to$20implement$20navigation$20transitions%7Csort:date/blink-dev/lWCtrTynaVk/Bvf4jIeEuPcJ))
* [Thoughts in 2015 by a Mozilla engineer](http://www.chrislord.net/2015/04/24/web-navigation-transitions/)
* [IE Page Transition Filters](https://schepp.dev/posts/today-the-trident-era-ends/#page-transition-filters)

## Alternatives

### SPA Polyfill

The proposed API for a Single-Page App should, in theory, be polyfillable by a
javascript library. This is because script has access to all of the elements
and effects that would be used in the transition.

However, we believe that this is hard to do. For instance, to achieve the
effect of the example page transition with only the background change, script
would have need to figure out how to visually present two copies of content
(other than the background color) and transition them.

Furthermore, a polyfill would not be able to do the transition across
Multiple-Page Apps.

## Other resources

[Brief explainer in docs](https://docs.google.com/document/d/1UmAL_w5oeoFxrMWiw75ScJDQqYd_a20bOEWfbKhhPi8/edit#heading=h.puannjfvfhee)
