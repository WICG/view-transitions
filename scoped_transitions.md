# Scoped Transitions
This doc is a summary of early design explorations to scope transitions to a DOM sub-tree. The following is a rough API sketch for how a developer would trigger the transition rooted on an element (other than the document's root element).

```js
element.createTransition({
  updateDOM() {
    /* … */
  },
});
```

The element becomes the 'scoped transition root' for the transition. It's the element that will host the pseudo-element tree and page-transition-container sub-trees will be created for descendants that have a page-transition-tag.

```
<the element>
└─ ::page-transition
   └─ ::page-transition-container(some-button)
      └─ ::page-transition-image-wrapper(some-button)
         ├─ ::page-transition-outgoing-image(some-button)
         └─ ::page-transition-incoming-image(some-button)
  
Note: We will probably need to change the naming, as 'page-transition' doesn't work.
Note: We might want to add an ID for a transition to control which transition the `page-transition-tag` applies to.
```

The rough algorithm for executing the transition is as follows:

1. At the next rendering opportunity after createTransition, the browser saves the painted output and geometry information for each shared element. The details are described in [7.3.4](https://drafts.csswg.org/css-shared-element-transitions-1/#perform-an-outgoing-capture-algorithm) except transforms are computed relative to the element.

2. The captured output above is painted in a stacking context which is a sibling of the element's stacking context. This is conceptually similar to the [page-transition-layer](https://drafts.csswg.org/css-shared-element-transitions-1/#page-transition-stacking-layer). For example:

  ```html
  <html>
    <style>
      .outer {
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
  
  The above generates the following stacking context hierarchy.
  
  ```
  root
  |_outer
  | |_inner
  |_outer-page-transition (pseudo-tree underneath)
  ```
  
  The outer-page-transition stacking context is painted immediately after `outer` in the stacking context hierarchy. Similar to 

## Constraints
An element which is the root for a transition must satisfy the following constraints. These constraints may stop being satisfied at any phase of the transition lifecycle and we'll need to define the fallback behaviour for such cases. The simplest option is to consider them a developer error and [skip the transition](https://drafts.csswg.org/css-shared-element-transitions-1/#skip-the-page-transition).

1. There shouldn't be an active transition on the element, its descendants or its ancestors. This is because a transition involves taking the painted output of an element and rendering it into a different stacking context. For example, in the following case:

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
