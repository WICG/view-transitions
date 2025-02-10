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

This delivers three benefits to the developer that were not achievable before:

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

Scoped view transitions have been proposed to the CSS Working Group
([#9890](https://github.com/w3c/csswg-drafts/issues/9890)) as a change to the
[CSS View Transitions Module Level 2][css-view-transitions-2] specification.
They are being prototyped in Chromium ([crbug.com/394052227](https://crbug.com/394052227))
behind the `--enable-features=ScopedViewTransitions` command-line flag.

[VT-api]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
[document-SVT]: https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
[v-t-pseudo]: https://developer.mozilla.org/en-US/docs/Web/CSS/::view-transition
[css-view-transitions-2]: https://drafts.csswg.org/css-view-transitions-2/

## Pseudo-element tree

The pseudo-element tree for a scoped view transition looks similar to the
[pseudo-element tree for a document view transition](https://drafts.csswg.org/css-view-transitions-1/#view-transition-pseudos),
except that it is associated with the scoped transition root instead of the
`<html>` element.

For example, the following page:

```html
<style>
  .scope-root {
    contain: layout;
    view-transition-name: outer;
  }
  .inner-group {
    view-transition-name: inner;
  }
</style>
<div class="scope-root">
  <div class="inner-group"></div>
</div>
<script>
  const element = document.querySelector('.scope-root');
  element.startViewTransition(...);
</script>
```

produces the following DOM subtree:

```
div.scope-root
└─ ::view-transition
   ├─ ::view-transition-group(outer)
   │  └─ ::view-transition-image-pair(outer)
   │     ├─ ::view-transition-old(outer)
   │     └─ ::view-transition-new(outer)
   └─ ::view-transition-group(inner)
      └─ ::view-transition-image-pair(inner)
         ├─ ::view-transition-old(inner)
         └─ ::view-transition-new(inner)
```

## Algorithm

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

Between steps 2 and 4, we need to pause the rendering of the scoped transition
root's subtree so that the developer can update it without presenting those
updates to the user.

## Constraints

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

## Pause rendering

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

## Box decorations

If a scoped transition root has `overflow:clip`, then its pseudo-element tree
is affected by the clip. If it is also tagged with `view-transition-name`, then
its snapshot will not include box decorations like `border` and effects like
`filter:blur()` which draw outside the clip.

This is a behavior difference of scoped view transitions compared to snapshots
of the `html` element which do include these things.

## Prior Work

[Jake Archibald, "Shadow DOM or not - shared element transitions" (Sep 2022)](https://docs.google.com/document/d/1kW4maYe-Zqi8MIkuzvXraIkfx3XF-9hkKDXYWoxzQFA/edit?usp=sharing)
considers an alternate Shadow DOM implementation.
