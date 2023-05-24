# Contents

# Introduction

Cross-document transitions are an extension to
[same-document transitions](https://drafts.csswg.org/css-view-transitions-1/), adding the semantics
necessary to display transitions when navigating across documents.

## Scope
[The main explainer](explainer.md) and the [`css-view-transitions-1` spec](https://drafts.csswg.org/css-view-transitions-1/)
provide a detailed explanation about same-document view transitions. Most of that is applicable to
cross-document transitions as well. This document provides explanations about the additional
semantics, and how cross-document transitions work.

# Design Principles

## Compatible with same-document transitions

Developers shouldn't have to jump through hoops or rethink their transition design when switching
between an MPA architecture and an SPA architecture. The main building blocks of the transition,
the way the states are captured, and the way the captured images are animated, should remain the
same, as much as possible.

## Declarative yet customizable

Cross-document transitions should work automatically without JavaScript intervention, and should
have the right CSS & JavaScript knobs for when the defaults are not enough.

## Same-origin

Cross-document view transitions are only enabled for
[same-origin](https://html.spec.whatwg.org/multipage/browsers.html#same-origin) navigations without a
[cross-origin redirect](https://html.spec.whatwg.org/#unloading-documents:was-created-via-cross-origin-redirects).
In the future we could examine relaxing this restriction in some way to same-site navigations.

# How it works

## In a nutshell
Both the old and new document need to [declaratively opt-in](#declarative-opt-in) to the transition
between them. If both opted in, and this is a [same-origin](#same-origin) navigation without
cross-origin redirects, the state of the old document is captured, using the
[same algorithm](https://drafts.csswg.org/css-view-transitions-1/#capture-old-state-algorithm) used
for same-document transitions.

When the new document is about to present the first frame, i.e. when
the document is no longer [render blocked](https://html.spec.whatwg.org/multipage/dom.html#render-blocked)
or at the course of [reactivation](https://html.spec.whatwg.org/multipage/browsing-the-web.html#reactivate-a-document) from prerendering/back-forward cache, the state of the new document is captured, also using the
[equivalent algorithm](https://drafts.csswg.org/css-view-transitions-1/#capture-new-state-algorithm).

If all conditions are met and both states are captured, the transition carries on to
[update the pseudo element styles](https://drafts.csswg.org/css-view-transitions-1/#update-pseudo-element-styles)
and display the animation, as if it was a same-document transition.

The new document can customize the style of the animation using the same techniques available for
same-document transitions. Both documents can interrupt the transition in different phases, or
observe its completion.

So to support cross-document view transition, the following things need to be specified:

1. A way for both documents to [opt in](#declarative-opt-in) to the transition.
1. The [lifecycle](#lifecycle): the exact moments in which the states are captured, and potentially
   fire [new events](#a-new-reveal-event) that corresponds to those moments.
1. A way to [observe](#javascript-observability) or skip a transition using JavaScript in both
   documents.


## Declarative opt-in

To enable cross-document transitions, the old and new documents need to be coordinated with each
other - as in, the transition names in the old document match the ones in the new document and the
effect of animating between them is intentional. Otherwise, there could be a situation where two
documents of the same origin define styles for same-document transitions independently, and enabling
this feature would create an unexpected transition between them.

This is an issue that is specific to cross-document transitions, as single-document transitions are
triggered imperatively in the first place.

The minimal functional opt-in would be a global declaration that the document supports view
transitions, e.g.:

```html
<meta name="view-transitions" content="same-origin">
```

though to make this fully expressive, e.g. opt in conditionally based on reduced-motion preferences,
versions, or URL patterns, this would need a more elaborate definition, e.g.:

```css
@cross-document-view-transitions: allow;
@prefers-reduced-motion {
   @cross-document-view-transitions: skip;
}
```

Note: The exact semantics of the conditional opt-in are TBD. See related open issues:
* w3c/csswg-drafts#8048
* w3c/csswg-drafts#8679
* w3c/csswg-drafts#8683

## Lifecycle

![Lifecycle chart for cross-document transitions](media/mpa-chart.svg)

### Capturing the old state

[The old state is captured](https://drafts.csswg.org/css-view-transitions-1/#capture-old-state-algorithm) right before the old document is hidden and a new one is shown.
In the HTML spec that moment is defined [here](https://html.spec.whatwg.org/#populating-a-session-history-entry:loading-a-document).
This can either happen during normal navigations, when the new document is about to be created,
in Back/Forward cache navigations, or when activating a prerendered document.

Before creating the new document (or activating a cached/prerendered one), the UA would [update the rendering](https://html.spec.whatwg.org/#update-the-rendering) and snapshot the old document, in the same manner a document is snapshotted for a same-document navigation.

The developer can use existing events like `navigate` (where available) or `click` to customize the
elements which have a view-transition-name in the old Document.

Example:
```js
navigation.addEventListener("navigate", event => {
  // Don't capture navigation-bar animation when navigating to home
  if (!new URL(event.destination.url).pathname.startsWith("/home"))
    navigationBar.viewTransitionName = "none";
});
```

### Capturing the new state

The [new state is captured](https://drafts.csswg.org/css-view-transitions-1/#capture-new-state-algorithm) right before the first [rendering opportunity](https://html.spec.whatwg.org/#rendering-opportunity)
of the new document. This allows the new document to use the
[render-blocking mechanism](https://html.spec.whatwg.org/#render-blocking-mechanism) as a way to
delay the transition.

As shown in the chart above, that first rendering opportunity can come in two cases, either
it's a newly initialized document that's no longer [render-blocked](https://html.spec.whatwg.org/multipage/dom.html#render-blocked), or it's a document that's been frozen due to back-forward cache
or prerendered, and is now being activated.

## JavaScript Observability

### `document.activeTransition`

In the same-document case, we gain access to a [`ViewTransition`](https://drafts.csswg.org/css-view-transitions-1/#viewtransition) object when we call [`startViewTransition()`](https://drafts.csswg.org/css-view-transitions-1/#ViewTransition-prepare). However, we don't have access to this
object for a declarative cross-document transition.

The proposal is to add a `document.activeViewTransition` property that would return an active `ViewTransition` object when there is an active transition, either cross-document or same-document.

This would allow skipping the transition and observing when it's finished.

Note: some of the properties of `ViewTransition`, like [`updateCallbackDone`](https://drafts.csswg.org/css-view-transitions-1/#dom-viewtransition-updatecallbackdone) are not relevant to cross-document
view transitions.

### A new (`reveal`?) event

Since the new state is [captured](#capturing-the-new-state) at a very precise point in time, we
might want to fire an event at that time, to let the new document make last-minute DOM changes
before the new state is captured, e.g. change transition names based on which images are loaded.

The new event would be fired at the first time the page ceases to be [render blocked](https://html.spec.whatwg.org/multipage/dom.html#render-blocked), and every time it is [reactivated](https://html.spec.whatwg.org/multipage/browsing-the-web.html#reactivate-a-document).

Note that this event is different from [`pageshow`](https://html.spec.whatwg.org/#event-pageshow) as
in the newly initialized document `pageshow` is only fired once the document is fully loaded.

See whatwg/html#9315 and w3c/csswg-drafts#8805

Related Issue: Do we want to enable delaying the transition with JavaScript? Maybe with a timeout? See w3c/csswg-drafts#8681

# Further discussions

See [the list of open issues labeled `css-view-transitions-2`](https://github.com/w3c/csswg-drafts/issues?q=css-view-transitions-2+label%3Acss-view-transitions-2) for the up-to-date list of issues.
