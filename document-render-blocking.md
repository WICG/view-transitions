# Overview

The Web is designed with a model for incremental rendering. When a Document is loading, the browser can render its intermediate states before fetching all the requisite sub-resources, executing all script or fetching/parsing the complete Document. While this is great to reduce the time for first paint, there is a tradeoff between showing a jarring flash of intermediate Document state (which could be unstyled or have more CLS) vs blocking rendering on high priority sub-resources within a reasonable timeout.

The [render-blocking](https://html.spec.whatwg.org/#render-blocking-mechanism) concept helps browsers in making this tradeoff. It lets authors specify the set of stylesheets and script elements which should block rendering. For example, a stylesheet with the rules necessary to ensure a stable layout. But authors can’t specify which nodes should be added to the DOM before first render. This proposal aims to fill this gap.

# View Transitions Use Case

The main use-case for this proposal is [cross-document View Transitions](https://drafts.csswg.org/css-view-transitions-2/). This feature enables authors to customize a seamless transition when navigating between 2 Documents. The rough flow is as follows:

- Before the old Document is unloaded, the browser walks through the DOM to identify elements which need to be animated for this transition. This is specified by the author using a CSS property: view-transition-name.

- When the new Document is ready for first render, i.e. all render blocking resources have been fetched, the browser walks through the DOM to look for elements with a view-transition-name. There can be 3 types of animations:

  - Exit animation: If a view-transition-name exists only in the old Document, it fades out.
  - Entry animation: If a view-transition-name exists only in the new Document, it fades in.
  - Morph animation: If a view-transition-name exists in both Documents, the widget in the old Document morphs to the size/position of the widget in the new Document.

- The browser builds a tree of pseudo-elements for the animations identified in step 2 before the first rendering opportunity. Authors can customize the transition by targeting the pseudo-elements in script within the first rAF.

Identifying all animations correctly requires the browser to render-block the new Document until all elements which will be assigned a view-transition-name have been added to the DOM. Otherwise morph animations will turn into exit animations and entry animations will get skipped. Since browsers use heuristics to optimally yield and render when fetching a new Document, a consistent transition UX across all browsers is not feasible without an explicit hint from developers to delay rendering until the requisite nodes have been parsed.

# Proposal

Add the [blocking attribute](https://html.spec.whatwg.org/#blocking-attributes) on the [HTMLHtmlElement](https://html.spec.whatwg.org/multipage/semantics.html#the-html-element). This is the [document element](https://dom.spec.whatwg.org/#document-element) for an HTML Document.

The timing for when this attribute can block rendering for a Document is already well defined in [render-blocking mechanism](https://html.spec.whatwg.org/multipage/dom.html#render-blocking-mechanism). The user agent [unblocks rendering](https://html.spec.whatwg.org/multipage/dom.html#unblock-rendering) on this element when it's done parsing the document as defined [here](https://html.spec.whatwg.org/multipage/parsing.html#the-end).

## Sample Code
### Block Rendering on Full Document Parsing
```html
<html blocking="render">
<body>
…
</body>
</html>
```

### Block Rendering on Partial Document Parsing
```html
<html blocking="render">
<body>
…
<script>
   if (doPartialBlocking) {
      document.documentElement.blocking="";
   }
</script>
</body>
</html>
```
