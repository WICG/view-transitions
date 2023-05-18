# Contents

# Introduction

See [the main explainer](explainer.md) for detailed explanation about view transitions.
This explainer extends the feature of same-document ("SPA") transitions to also include
cross-document transitions ("MPA").

While same-document transitions are useful in themselves and an important stepping stone, allowing
cross-document transitions would unlock a capability that so far has been available only within the
same document.

# Goals

## Compatible with same-document transitions

The vast majority of work for cross-document transitions is based on same-document transitions.
This allows developers to use the same techniques for both, and to avoid big refactors if
changing architectures.

## Declarative & Customizable

Cross-document transitions should work by default without JavaScript intervention, and should have
the right JavaScript knobs for when the defaults are not enough.

# How it works

## In a nutshell
Documents declare that they support same-origin cross-document transitions, using a
[meta tag](#opt-in). When a navigation between two such documents takes place (and has no
cross-origin redirects in the middle), the state of the old document is captured, in the same
manner as same-origin transitions. When the new document is ready for the transition (i.e., when all render-blocking resources are ready), the new state is captured,
and the transition continues as if it was a same-document transition, with the appropriate pseudo-elements.

The new document can customize the style of the animation using the same techniques available for same-document transitions.

Both documents can interrupt the transition or customize it using JavaScript in different phases.

## Same-origin

Cross-document view transitions are only enabled for same-origin navigations without a
[cross-origin redirect](https://html.spec.whatwg.org/#unloading-documents:was-created-via-cross-origin-redirects).
In the future we could examine exposing them in some way to same-site or cross-origin navigations.

## Opt-in

To enable cross-document transitions, both the old and new document need to add a meta tag. This tag
indicates that the author wants to enable transitions for same-origin navigations to/from this
Document.


### Issues

1. The meta tag can be used to opt-in to other navigation types going forward: same-document, same-site, etc.

1. Using meta-tags prevents the declaration being controlled by media queries, which feels important for `prefers-reduced-motion`.
See [w3c/csswg-drafts#8048](https://github.com/w3c/csswg-drafts/issues/8048).

## Lifecycle

![Lifecycle chart for cross-document transitions](media/mpa-chart.svg)

### Capturing the old state

[The old state is captured](https://drafts.csswg.org/css-view-transitions-1/#capture-old-state-algorithm) right before the old document is hidden and a new one is shown.
In the HTML spec that moment is defined [here](https://html.spec.whatwg.org/#populating-a-session-history-entry:loading-a-document).
This can either happen during normal navigations, when the new document is about to be created,
in Back/Forward cache navigations, or when activating a prerendered document.

Before creating the new document (or activating a cached/prerendered one), the UA would [update the rendering](https://html.spec.whatwg.org/#update-the-rendering) and snapshot the old document, in the same manner a document is snapshotted for a same-document navigation.

Note that currently there are no planned new events for the exit transition.
The developer can use existing events like `navigate` or `click` to customize the
exit transition at moments that should be late enough.

#### Issues

1. Should we enable skipping the transition on exit? This could be done on`pagehide`.

### Capturing the new state

The [new state is captured](https://drafts.csswg.org/css-view-transitions-1/#capture-new-state-algorithm) at the first [rendering opportunity](https://html.spec.whatwg.org/#rendering-opportunity)
of the new document. This allows the new document to use the
[render-blocking mechanism](https://html.spec.whatwg.org/#render-blocking-mechanism) as a way to
delay the transition.

For most cases, opting in via the meta tag, styling with the pseudo-elements, and delaying the transition using the
[render-blocking mechanism](https://html.spec.whatwg.org/#render-blocking-mechanism) should be sufficient. But there are certain cases where further customization is desired, for example:

* Abort the transition if certain conditions apply.

* Modify the pseudo-element style based on certain conditions, e.g. apply transition
   names only to images that are already loaded.

* Prepare the exit transition right before capture.

There are several options as to how to enable this:

1. Fire an event right before the new document capture. This would be either right
   before the first `requestAnimationFrame` callback, or after `pageshow` in the reactivation case. Potential names: `reveal`, `beforepagetransition`. Note that in the latter case, it's too late to delay the transition via the render-blocking mechanism. This event doesn't have to be specific to transitions.

1. Expose something like a `document.currentRevealTransition` or so that the script can
   query or skip. We might also want to enable delaying the transition with a promise,
   the same way that's available for same-document transitions.

### Issues

1. Customizing which resources are render-blocking in `reveal` requires it to be dispatched before parsing `body`, or explicitly allow render-blocking resources to be added until this event is dispatched.

1. We'd likely need an API for the developer to control how much Document needs to be fetched/parsed before the transition starts, or delay the capture with a promise.

1. The browser defers painting the new Document until all render-blocked resources have been fetched or timed out. Do we need an explicit hook for when this is done or could the developer rely on existing `load` events to detect this? This would allow authors to add viewTransitionNames based on what the new Document's first paint would look like.

1. Should we allow access to the transition once its started? Perhaps access to a [ViewTransition](https://drafts.csswg.org/css-view-transitions-1/#viewtransition) object or similar?.