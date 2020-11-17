# Shared Element Transitions

Shared Element Transitions is a proposal for a new script API that allows a
simple set of transitions in both Single-Page Applications (SPAs) and
Multi-Page Applications (MPAs).

### Root Transitions

The proposal can be split into two parts: a root transition, and a shared
element transition.  As an example of a root transition, consider the following
snippet of code:

```js
function changeBodyBackground() {
  document.body.style = "background: blue";
}

function handleTransition() {
  const transition = document.createPageTransition({
    rootTransition: "reveal-left",
    duration: 300
  });

  transition.prepare().then(() => {
    changeBodyBackground();
    transition.start();
  });
}
```

If script simply calls `changeBodyBackground()`, then the `body` element's
background will change to blue. The change will appear on the next visual
frame. However, if script calls `handleTransition()`, then the following steps
happen:

* We create a page transition with a "reveal-left" root transition, and a 300ms
  transition duration.
* We prepare the transition, which asynchronously saves a copy of the pixels
  currently present on the screen. When saving is done, the promise resolves.
* After the promise resolves, we call `changeBodyBackground()`, which changes
  the `body` element's background to blue, and begin the transition.
* Because the effect specified is "reveal-left", the saved pixels slide to the
  left, revealing the new blue background body on the page.

Note that to accomplish a similar effect as a polyfill, the script would need
to make a copy of the whole page, or draw to canvas, in order to have seemingly
two copies of the DOM. One copy would slide and another one be revealed with
some changes.

Below is a video of some of the sample transitions:
[![Video Link for Shared Element Transitions](https://img.youtube.com/vi/yDFyLEN6aKk/0.jpg)](https://www.youtube.com/watch?v=yDFyLEN6aKk)

A similar effect could be achieved in the MPA casee, although the API is likely
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
The effect would be that the shared elements go from the old location to the
new location _while_ root transition takes place.

The above example API may change to include a sequence of elements that need to
be shared, both in the `prepare` and the `start` phases:

```js
  transition.prepare([element1, element2]).then(() => {
    changeBodyBackground();
    transition.start([element1, element2]);
  });
```

This means that the elements specified in the prepare call automatically
transition to the location and place of elements corresponding elements
specified in the start call.

In the example above, the same elements specified so the intended effect is for
those elements to remain in place while the changed background is revealed by
old background sliding left.

TODO: Add example video.

## Previous Efforts

There have been prior efforts in this space, ranging from APIs proposed for the
web platform to effects like IE5 transition effects that were removed. We
believe that the current proposal aligns web development with native mobile
development by bringing similar transition capabilities to the web platform.

* [Navigation Transition Design](https://docs.google.com/document/d/17jg1RRL3RI969cLwbKBIcoGDsPwqaEdBxafGNYGwiY4/edit?pli=1#heading=h.tdzcka62qyfo) ([intent to implement](https://groups.google.com/a/chromium.org/forum/#!searchin/blink-dev/intent$20to$20implement$20navigation$20transitions%7Csort:date/blink-dev/lWCtrTynaVk/Bvf4jIeEuPcJ))
* [Thoughts in 2015 by a Mozilla engineer](http://www.chrislord.net/2015/04/24/web-navigation-transitions/)
* [IE Page Transition Filters](https://schepp.dev/posts/today-the-trident-era-ends/#page-transition-filters)

## Other resources

[Brief explainer in docs](https://docs.google.com/document/d/1UmAL_w5oeoFxrMWiw75ScJDQqYd_a20bOEWfbKhhPi8/edit#heading=h.puannjfvfhee)
