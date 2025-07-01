# Scoped View Transitions

Scoped view transitions are a proposed extension to the
[View Transition API][VT-api] to help developers perform transitions within the
scope of a DOM subtree.

The new API looks like this:

```js
element.startViewTransition(() => {
  // Update the DOM somehow.
});
```

This performs a same-document view transition similar to
[`document.startViewTransition()`][document-SVT], except that we are now calling
`startViewTransition()` on an arbitrary HTML element instead of the document.

That element becomes the **scoped transition root** for the transition, which
means that it will host the [`::view-transition`][v-t-pseudo] pseudo-element
tree, and act as a container for the transition animations.

## Motivation

Scoped view transitions delivers four benefits to the developer that were not achievable before:

* _Concurrent transitions:_  Two or more elements can run view transitions at the same
  time without being aware of each other.  For example, different component libraries
  may each want to use view transitions and remain composable with each other.

* _Transitions affected by ancestor properties:_  View transitions can render
  inside a container that applies a clip, transform, or animation to it. For
  example, a view transition may run inside content while that content is
  scrolling.

* _Smooth rendering outside the transition scope:_  View transitions have to [pause
  rendering](#Pause-rendering) while the DOM callback is running, but now we can pause rendering in
  only part of the page.

* _Transitions respect z-index:_  Non-transitioning content outside the scoped
  transition root can now paint on top of the transitioning content.  This is
  useful for overlays such as menus and notification bars, which previously
  could not stack in front of the pseudo-element tree.

## Current status

Scoped view transitions have been proposed to the CSS Working Group
([#9890](https://github.com/w3c/csswg-drafts/issues/9890)) as a change to the
[CSS View Transitions Module Level 2][css-view-transitions-2] specification.
They are being prototyped in Chromium ([crbug.com/394052227](https://crbug.com/394052227))
behind the `--enable-features=ScopedViewTransitions` command-line flag.

Scoped view transitions were presented at the BlinkOn 20 conference in April 2025:
[slides](https://bit.ly/svt-blinkon),
[recording](https://bit.ly/svt-blinkon-video).

Here is a [**DEMO**](https://output.jsbin.com/runezug/quiet) of scoped view transitions,
showing concurrent transitions, transitioning inside a scroller, nested scoped transitions,
and transitioning behind a higher z-index overlay.

[VT-api]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
[document-SVT]: https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
[v-t-pseudo]: https://developer.mozilla.org/en-US/docs/Web/CSS/::view-transition
[css-view-transitions-2]: https://drafts.csswg.org/css-view-transitions-2/

## How to use

You can play with scoped view transitions in Google Chrome today.

* Use Chrome 139 or newer (currently in dev and beta [channels](https://support.google.com/chrome/a/answer/9027636?hl=en)).

* Enable "Experimental Web Platform features" in `chrome://flags`.
  Alternatively, pass `--enable-features=ScopedViewTransitions` on the command line.

* In your HTML, declare a scope element with `contain: view-transition layout`, and
  one or more participants with `view-transition-name` style. Example:

```
<style>
  #scope { contain: view-transition layout }
  #participant { view-transition-name: greeting }
</style>
<div id="scope">
  <div id="participant">Hello</div>
</div>
```

* In your Javascript, call `startViewTransition` on the scope. Pass a callback that
  modifies the participants.

```
<script>
  scope.startViewTransition(() => {
    participant.innerText = "World";
  });
</script>
```

Try the above in your browser: https://output.jsbin.com/geyanat

### Known issues

* It's currently necessary to explicitly set `contain: layout` on the scope.
  If you forget to do this, we may helpfully remind you by crashing ([crbug.com/426218225](https://crbug.com/426218225)).

* Scopes that are scrollable areas (`overflow: auto` or `overflow: scroll`)
  do not behave as expected, because the pseudo-tree renders inside
  the scrolling contents ([#12324](https://github.com/w3c/csswg-drafts/issues/12324),
  [crbug.com/417988089](https://crbug.com/417988089)). To avoid this problem,
  make your scope element a child of the scrollable area.

* In general, there are open questions about the behavior of a "self-participating scope", i.e.
  a scope element that is a participant (`view-transition-name`) in its own
  transition. See [Self-Participating Scopes](https://bit.ly/svt-sps).

## Design

### Pseudo-element tree

The pseudo-element tree for a scoped view transition looks similar to the
[pseudo-element tree for a document view transition](https://drafts.csswg.org/css-view-transitions-1/#view-transition-pseudos),
except that it is associated with the scoped transition root instead of the
`<html>` element.

The example above produces the following DOM subtree during the transition:

```
div.scope
└─ ::view-transition
   └─ ::view-transition-group(greeting)
      └─ ::view-transition-image-pair(greeting)
         ├─ ::view-transition-old(greeting)
         └─ ::view-transition-new(greeting)
```

### Algorithm

The steps for a scoped view transition are based on the
[steps for a document view transition](https://drafts.csswg.org/css-view-transitions-1/#lifecycle)
with appropriate modifications.  At a high level:

1. Create the [`ViewTransition`](https://drafts.csswg.org/css-view-transitions-1/#viewtransition) object.

2. At the next rendering opportunity, capture the painted output of each tagged
   element under the scoped transition root, and create the pseudo-element tree
   with `::view-transition-old` pseudo-elements.  A tagged element's geometry
   information is computed relative to the scoped transition root.

3. Invoke the callback passed to `startViewTransition`.

4. Create the `::view-transition-new` pseudo-elements and set up the default
   animations.

5. Run the animations.

6. Clean up by destroying the pseudo-element tree.

Between steps 2 and 4, we need to [pause the rendering](#Pause-rendering) of the
scoped transition root's subtree, so that any DOM updates inside that subtree
that occur during the callback are not presented to the user prematurely.

### Constraints

Scoped view transitions impose certain constraints:

* There shouldn't be more than one active transition running on the same scoped
  transition root. If a new transition is started on the same element, we
  should cancel the old one.

* A tagged element cannot participate (by generating a `::view-transition-group`)
  in more than one active transition at the same time. If a new transition is
  started which would trigger this situation, we should cancel the old one.

* The scoped transition root must have `contain: layout`. This ensures that it
  generates a [stacking context](https://developer.mozilla.org/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
  so that its painted output can be captured as an atomic unit.

Within these constraints it should be possible for two view transitions to run
on different scoped transition roots even if one is a descendant of the other.
This is important for independent web components to be composable.

### Tag containment

We're adding `contain: view-transition` to help developers avoid tag collisions
when nesting components that use view transitions.

A scoped view transition looks for tagged participants, starting with the scope
itself. If this tag search encounters a descendant with `contain: view-transition`,
it ignores that element and everything inside it, on the assumption that those tags
belong to a different scope.

It's recommended to set `contain: view-transition` on any element that will be
used as a scope.

### Pause rendering

The developer can asynchronously mutate the DOM during the `startViewTransition`
callback (which may return a Promise). To avoid presenting intermediate states
to the user, we must pause the rendering of the DOM being transitioned.

Document view transitions pause the rendering of the entire document while the
callback is running, but scoped view transitions will only pause the rendering
of the DOM subtree under the scoped transition root.

When the callback is finished and the transition animations are running, the
rendering is no longer paused, but each tagged element participating in the
transition has its rendering hoisted into the corresponding
`::view-transition-new` pseudo-element. (This is the same for scoped and
document view transitions.)

### Transition root

Now that view transitions are scoped, we want to make it easy for the developer
to determine which scope a `ViewTransition` object is associated with.
So we're adding a `transitionRoot` property:

```js
interface ViewTransition {
    ...
    readonly attribute Element transitionRoot;
    ...
};
```

Example usage:

```js
function processAnimations(transition) {
    let anims = transition.transitionRoot.getAnimations()
    ...
}
...
let transition = el.startViewTransition();
transition.ready.then(() => processAnimations(transition));
```

See [CSSWG resolution for the transitionRoot property](https://github.com/w3c/csswg-drafts/issues/9908#issuecomment-2165621635).

## Prior Work

[Jake Archibald, "Shadow DOM or not - shared element transitions" (Sep 2022)](https://docs.google.com/document/d/1kW4maYe-Zqi8MIkuzvXraIkfx3XF-9hkKDXYWoxzQFA/edit?usp=sharing)
considers an alternate Shadow DOM implementation.
