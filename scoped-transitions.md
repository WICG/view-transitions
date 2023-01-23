# Scoped Transitions

This doc is a summary of early design explorations to scope transitions to a DOM sub-tree. It uses the pseudo-element tree to describe the UA generated tree to refer to the existing spec. A [separate doc considers an alternate Shadow DOM implementation](https://docs.google.com/document/d/1kW4maYe-Zqi8MIkuzvXraIkfx3XF-9hkKDXYWoxzQFA/edit?usp=sharing).

The following is a rough API sketch for how a developer would trigger the transition rooted on an element (other than the document's root element).

```js
element.startViewTransition(() => {
  // Update the DOM somehow.
});
```

The element becomes the **scoped-transition-root** for the transition. It's the element that will host the pseudo-element tree and page-transition-container sub-trees will be created for descendants that have a `page-transition-tag`. For example, the following page:

```html
<style>
  .outer {
    page-transition-tag: outer;
    contain: layout;
  }
  .inner {
    page-transition-tag: inner;
    contain: layout;
  }
</style>
<div class="outer">
  <div class="inner"></div>
</div>
<script>
  document.querySelector('.outer').createTransition(…);
</script>
```

produces the following DOM tree under `outer`:

```
outer
└─ ::page-transition
   ├─ ::page-transition-container(outer)
   │  └─ ::page-transition-image-wrapper(outer)
   │     ├─ ::page-transition-outgoing-image(outer)
   │     └─ ::page-transition-incoming-image(outer)
   └─ ::page-transition-container(inner)
      └─ ::page-transition-image-wrapper(inner)
         ├─ ::page-transition-outgoing-image(inner)
         └─ ::page-transition-incoming-image(inner)

Note: We will probably need to change the naming, as 'page-transition' doesn't work.
```

The algorithm for executing the transition is as follows:

1. At the next rendering opportunity after `createTransition`, the browser saves the painted output and geometry information for each tagged element under scoped-transition-root. The details are described in [7.3.4](https://drafts.csswg.org/css-shared-element-transitions-1/#perform-an-outgoing-capture-algorithm) except transforms are computed relative to the element. A task is queued to dispatch the `startViewTransition` callback after this step.

2. For every subsequent rendering opportunity, the browser renders the sub-tree under scoped-transition-root using the cached output captured in step 1. This is done by generating the pseudo-element sub-tree (originating from scoped-transition-root) as described in [7.9](https://drafts.csswg.org/css-shared-element-transitions-1/#create-transition-pseudo-elements-algorithm) except only outgoing-image pseudo-elements are generated. See [Timing for generating pseudo elements](#timing-for-generating-pseudo-elements) for details.

   This allows the developer to update scoped-transition-root's subtree without presenting it to the user. See [Suppressing rendering](#suppressing-rendering) for details.

3. The captured output above is painted in a stacking context which is a descendant of scoped-transition-root's stacking context. The above example generates the following stacking context hierarchy.

   ```
   root
   └─ outer
      ├─ inner
      └─ outer-page-transition (pseudo-tree underneath)
   ```

   If the scoped-transition-root is tagged, it's snapshot uses [content-capture](https://github.com/WICG/shared-element-transitions/blob/main/explainer.md#more-granular-style-capture) mode. This means that only the element's descendants (including both text and elements) are painted in the snapshot while box decorations (like border, box-shadow) continue to paint in the outer stacking context. See [root snapshot](#root-snapshot) for details.

4. Once the `startViewTransition` callback is finished, incoming-image pseudo-elements are added to the tree generated in step 2. Default animations are added as defined in [7.8](https://drafts.csswg.org/css-shared-element-transitions-1/#animate-a-page-transition-algorithm).

## Constraints

An element which is the root for a transition has the following constraints. These constraints may stop being satisfied at any phase of the transition lifecycle and we'll need to define the fallback behavior for such cases. The simplest option is to consider them a developer error and [skip the transition](https://drafts.csswg.org/css-shared-element-transitions-1/#skip-the-page-transition).

1. There shouldn't be an active transition on the element, its descendants or its ancestors. This is because a transition involves taking the painted output of an element and rendering it into a pseudo-element. For example, in the following case:

   ```html
   <style>
     .outer {
       page-transition-tag: outer;
     }
     .inner {
       page-transition-tag: inner;
     }
   </style>
   <div class="outer">
     <div class="inner"></div>
   </div>
   ```

   ```js
   document.createTransition(…);
   document.querySelector('.outer').createTransition(…);
   ```

   There will be an image pseudo-element for `inner` in pseudo-elements generated on `html` and `outer`. Its ambiguous which pseudo-element it should be painted in.
   
   An alternate less severe limitation is: "No descendant of scoped-transition-root should be a shared element in any other transition". If the scoped-transition-root itself is tagged, its entire painting (with its pseudo-tree) can be placed in a image pseudo-element generated under its ancestor. But if one of its descendants is tagged in scoped-transition-root's ancestor's transition, then its unclear which pseudo-element its painting should go to. Given that the use-case for concurrent scoped transitions is independent components, a root transition shouldn't need to tag elements within a transitioning embedded component.

   Note: We could provide an API to get the active transitions an element is involved in, so the developer can choose to wait for them.

2. The element which is the root for a transition must have `contain: layout`. This ensures it generates a stacking context and its painted output can be captured as an atomic unit.

## Timing for generating pseudo elements

Pseudo-elements generated in step 2 don't need to be developer exposed so UAs can use an alternate approach. Using pseudo-elements (and default browser CSS) here helps define a consistent behavior for how snapshots are rendered if the scoped-transition-root is resized. For example, the ::page-transition pseudo-element is going to be `position: absolute` and will use scoped-transition-root as its containing block. The exact scaling/clipping we get on the snapshots will be determined by the CSS on this pseudo-element tree.

A simpler option could be to treat the entire content captured under scoped-transition-root as an atomic snapshot which is scaled to fill the scoped-transition-root similar to `object-fit: fill`.

## Suppressing rendering

Transitions allow the developer to asynchronously mutate the DOM to the next state while the browser presents the visual output of the previous state to the user. This requires suppressing rendering of the DOM being transitioned to prevent presenting intermediate states to the user. The options for this are:

1. Rendering opportunities are paused. The developer can trigger style/layout via script APIs like `getComputedStyle` but [update the rendering](https://html.spec.whatwg.org/multipage/webappapis.html#update-the-rendering) loop doesn't run. This is developer observable since script callbacks (like rAF) won't be dispatched.

   This behaviour aligns with [render-blocking](https://html.spec.whatwg.org/multipage/dom.html#render-blocking-mechanism). Cross-document transitions can rely on render-blocking as an independent feature to control the first paint of the new Document. The same-document API provides the same contract, rendering opportunities remain paused until the promise returned by updateDOM callback resolves. However it can't be used for scoped transitions since a transition in a sub-tree shouldn't pause rendering for the complete Document.
  
2. Continue running rendering opportunities but skip painting the DOM tree participating in a transition.

In both cases, the browser needs to ensure all animations within the DOM sub-tree are paused. The proposal is to use 1 for root transitions and 2 for scoped transitions.

## Root snapshot

The behaviour for root snapshot differs between root and scoped transitions. For root transitions, snapshots of the `html` element include box decorations like `background` and effects like `filter` applied to the root element. But scoped transitions exclude these from scoped-transition-root's snapshot.

The reason for this is the impact of `overflow` clipping on the snapshots. For instance, scoped-transition-root could have `overflow:clip` and `filter:blur(5px)`. The blur will draw outside the box because `overflow:clip` only affects the content (not self effects). But the pseudo-element displaying scoped-transition-root's image will be its descendant. So it should clip the image and as a result will clip these box decorations.

Updates to these properties on scoped-transition-root are immediately painted (as opposed to being animated).

