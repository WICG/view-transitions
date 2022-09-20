# Scoped Transitions
This doc is a summary of early design explorations to scope transitions to a DOM sub-tree. The following is a rough API sketch for how a developer would trigger the transition rooted on an element (other than the document's root element).

```js
element.createTransition({
  updateDOM() {
    /* … */
  },
});
```

The element becomes the scoped-transition-root for the transition. It's the element that will host the pseudo-element tree and page-transition-container sub-trees will be created for descendants that have a page-transition-tag. For example, the following page:

```html
<html>
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
  <body>
    <div class="outer" id="outer">
      <div class="inner"></div>
    </div>
  </body>
  <script>
    outer.createTransition(...);
  </script>
</html>
```

produces the following DOM tree under `outer`:

```
outer
|_::page-transition
   |_::page-transition-container(outer)
   |  |_::page-transition-image-wrapper(outer)
   |     |_::page-transition-outgoing-image(outer)
   |     |_::page-transition-incoming-image(outer)
   |_::page-transition-container(inner)
      |_::page-transition-image-wrapper(inner)
         |_ ::page-transition-outgoing-image(inner)
         |_ ::page-transition-incoming-image(inner)
  
Note: We will probably need to change the naming, as 'page-transition' doesn't work.
Note: We might want to add an ID for a transition to control which transition the `page-transition-tag` applies to.
```

The algorithm for executing the transition is as follows:

1. At the next rendering opportunity after createTransition, the browser saves the painted output and geometry information for each tagged element under scoped-transition-root. The details are described in [7.3.4](https://drafts.csswg.org/css-shared-element-transitions-1/#perform-an-outgoing-capture-algorithm) except transforms are computed relative to the element. An async task is used to dispatch the updateDOM callback after this step.

2. For every subsequent rendering opportunity, the browser renders the sub-tree under scoped-transition-root using the cached output captured in step 1. This is done by generating the pseudo-element sub-tree (originating from scoped-transition-root) as described in [7.9](https://drafts.csswg.org/css-shared-element-transitions-1/#create-transition-pseudo-elements-algorithm) except only outgoing-image pseudo-elements are generated. This allows the developer to update scoped-transition-root's subtree without presenting it to the user.

   Note: Pseudo-elements at this stage don't need to be developer exposed so UAs can use an alternate approach for this step. Using pseudo-elements (and default browser CSS) here helps define a consistent behaviour for snapshots are updated if the scoped-transition-root is resized.

3. The captured output above is painted in a stacking context which is a descendant of scoped-transition-root's stacking context. The above example generates the following stacking context hierarchy.
  
   ```
   root
   |_outer
     |_inner
     |_outer-page-transition (pseudo-tree underneath)
   ```
  
   If the scoped-transition-root is tagged, it's snapshot uses [content-capture](https://github.com/WICG/shared-element-transitions/blob/main/explainer.md#more-granular-style-capture) mode. This means that only the element's descendants (including both text and elements) are painted in the snapshot while box decorations (like border, box-shadow) continue to paint in the outer stacking context.
  
4. Once the updateDOM callback is finished, incoming-image pseudo-elements are added to the tree generated in step 2. Default animations are added as defined in [7.8](https://drafts.csswg.org/css-shared-element-transitions-1/#animate-a-page-transition-algorithm).

## Constraints
An element which is the root for a transition has the following constraints. These constraints may stop being satisfied at any phase of the transition lifecycle and we'll need to define the fallback behaviour for such cases. The simplest option is to consider them a developer error and [skip the transition](https://drafts.csswg.org/css-shared-element-transitions-1/#skip-the-page-transition).

1. There shouldn't be an active transition on the element, its descendants or its ancestors. This is because a transition involves taking the painted output of an element and rendering it into a pseudo-element. For example, in the following case:

   ```html
   <style>
    .outer {
     page-transition-tag: outer;
    }
    .inner {
      page-transition-tag: inner;
    }
   <div class="outer" id="outer">
    <div class="inner">
    </div>
   </div>
   ```
  
   ```js
    document.createTransition(...);
    outer.createTransition(...);
   ```
  
   There will be an image pseudo-element for `inner` in transitions on document and `outer` and its ambigious which pseudo-element it should be painted in.
  
2. The element which is the root for a transition must have `contain: layout`. This ensures it generates a stacking context and its painted output can be captured as an atomic unit.

## Selector Syntax
The CSS selector options for the pseudo-trees can be:

* [part](https://w3c.github.io/csswg-drafts/css-shadow-parts-1/#part) selector which is spec'd to match elements in shadow DOM ooriginating from an element. `html::part(container)` for document transitions and `#outer::part(container)` if outer is the scoped-transition-root. This implies that `#outer` can not be a shadow host for author's shadow DOM since which shadow DOM `#outer::part(container)` is targeting is ambiguous.

* Pseudo-element syntax such as `html::page-transition::container(foo)` and `#outer::page-transition::container(foo)`.

* `transition(...)` which is a new CSS function. The syntax is similar to `::part` but is limiting to page-transition elements originating from a DOM element. For example, `html::transition(container)` and `#outer::transition(container)`. This selector could be backed by a shadow DOM or pseudo-element based implementation.
