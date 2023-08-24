# Overview

The Web is designed with a model for incremental rendering. When a Document is loading, the browser can render its intermediate states before fetching all the requisite sub-resources, executing all script or fetching/parsing the complete Document. While this is great to reduce the time for first paint, there is a tradeoff between showing a jarring flash of intermediate Document state (which could be unstyled or have more CLS) vs blocking rendering on high priority sub-resources within a reasonable timeout.

The [render-blocking](https://html.spec.whatwg.org/#render-blocking-mechanism) concept helps browsers in making this tradeoff. It lets authors specify the set of stylesheets and script elements which should block rendering. For example, a stylesheet with the rules necessary to ensure a stable layout. But authors can’t specify which nodes should be added to the DOM before first render. This proposal aims to fill this gap.
 
### Disclaimer

Incremental rendering is a fundamental aspect of the Web. It ensures users wait the minimal time necessary before seeing any content from the new Document. At the same time, the tradeoff between a "good" (stable layout with above the fold content) and "fast" (how soon the first frame shows up) is difficult to get right. For this reason, browsers err towards keeping this tradeoff internal to prevent developers from unintentionally regressing the user experience.

While we acknowledge that the View Transition use-case necessitates author input into this tradeoff, we want to strive for an API shape which keeps the feature from becoming a footgun for authors.

# View Transitions Use Case

The main use-case for this proposal is [cross-document View Transitions](https://drafts.csswg.org/css-view-transitions-2/). This feature enables authors to customize a seamless transition when navigating between 2 Documents. The rough flow is as follows:

- Before the old Document is unloaded, the browser walks through the DOM to identify elements which need to be animated for this transition. This is specified by the author using a CSS property: view-transition-name.

- When the new Document is ready for first render, i.e. all render blocking resources have been fetched, the browser walks through the DOM to look for elements with a view-transition-name. There can be 3 types of animations:

  - Exit animation: If a view-transition-name exists only in the old Document, it fades out.
  - Entry animation: If a view-transition-name exists only in the new Document, it fades in.
  - Morph animation: If a view-transition-name exists in both Documents, the widget in the old Document morphs to the size/position of the widget in the new Document.

- The browser builds a tree of pseudo-elements for the animations identified in step 2 before the first rendering opportunity. Authors can customize the transition by targeting the pseudo-elements in script within the first rAF.

Identifying all animations correctly requires the browser to render-block the new Document until all elements which will be assigned a view-transition-name have been added to the DOM. Otherwise morph animations will turn into exit animations and entry animations will get skipped. Since browsers use heuristics to optimally yield and render when fetching a new Document, a consistent transition UX across all browsers is not feasible without an explicit hint from developers to delay rendering until the requisite nodes have been parsed.

# Other Use Cases

There are a few other scenarios where a feature to control when the parser yields for rendering can be helpful:

- Lower CLS: A stable layout of the DOM depends on both parsing the requisite DOM nodes and fetching relevant stylesheets. Without control over parsing, its possible that the browser does multiple renders with layout shifts as more of the DOM is parsed.
Authors will sometimes initially set `display: none` or `opacity: 0` to hide the whole Document to prevent this, only showing it when enough of the Document is parsed.

- Atomic rendering of semantic elements: A UI widget built using a DOM sub-tree might not make sense to render partially. Consider a menu where only half the buttons show up on first render. Authors could mark sections in the Document which semantically render one widget so the browser doesn't yield midway through parsing one widget.

- Optimal Yielding: The browser may yield later than was necessary leading to rendering more what's required for above the fold content. A developer hint about a yielding trigger could imply the first frame has less DOM to parse, style, and layout. Browsers can optimize paint to be limited to onscreen content but the prior stages are executed over the entire DOM.
However, its difficult for authors to know when the above-the-fold content ends given the variety of device form factors. This situation could also be solved better by `content-visibility: auto` which can optimize out style/layout for offscreen content.

These use-cases are not the primary problem targeted by this proposal, they are listed to evaluate whether the ability to block parsing should be limited to when the new Document will be displayed with a View Transition or all loads.

# Dependencies

The set of elements which need to block rendering for View Transition depends on which Document the user is coming from. A real world example is as follows.

The user is navigating between Documents of a site which has a header. This header can be scrolled offscreen by the user, so it's not guaranteed to be onscreen when a navigation is initiated. The following cases are possible:

- The header was onscreen on the old Document and will be onscreen on the new Document. The author wants a morph animation which needs the header to be parsed before first render.

- The header was not onscreen on the old Document and/or won't be onscreen on the new Document (for instance because of scroll restoration). The author wants just a full page animation, header does not need to be parsed before first render.

The above requires the new Document to know about the old Document's visual state when the transition started. This can't be done trivially today. The Navigation API provides the list of [entries](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/entries) and the [current entry](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/currentEntry) but there is no notion of a "previous entry" before the current entry was committed.

[html/256](https://github.com/WICG/navigation-api/issues/256) addresses this. The examples in this proposal rely on the API proposed.

# Proposals

## Blocking Attribute

Add the [blocking attribute](https://html.spec.whatwg.org/#blocking-attributes) on the [HTMLHtmlElement](https://html.spec.whatwg.org/multipage/semantics.html#the-html-element). This is the [document element](https://dom.spec.whatwg.org/#document-element) for an HTML Document.

The timing for when this attribute can block rendering for a Document is already well defined in [render-blocking mechanism](https://html.spec.whatwg.org/multipage/dom.html#render-blocking-mechanism). The user agent [unblocks rendering](https://html.spec.whatwg.org/multipage/dom.html#unblock-rendering) on this element when it's done parsing the document as defined [here](https://html.spec.whatwg.org/multipage/parsing.html#the-end).

This approach neatly fits with the existing `blocking` primitive in html. The con is that while its trivial to block rendering until the full Document is parsed, more not-so-obvious code is needed to optimally block only on the minimal requisite set of elements. That makes it likely that authors will just block on full parsing since that will fix the correctness issues.

### Sample Code

#### Block Rendering on Full Document Parsing
```html
<html blocking="render">
<body>
…
</body>
</html>
```

#### Block Rendering on Partial Document Parsing

```html
<html blocking="render">
<script>
  // The set of element IDs that should block rendering.
  let blockingElementIds = new Set();

  function maybeUnblockRendering() {
    if (blockingElementIds.size == 0) {
      document.documentElement.blocking="";
    }
  }

  // The value returned by getState() is set by the old Document in
  // the `navigate` event. It tracks whether the old Document add a
  // `view-transition-name` to the header.
  if (navigation.initialLoad.from().getState().morphHeader) {
    blockingElementIds.add("header-id");
  }
  maybeUnblockRendering();
</script>
<body>
…
<div id="header-id">
  ...
</div>
<script>
  // When an element is parsed, remove it from the blocking set and
  // unblock rendering if all blocking elements have been parsed.
  blockingElementIds.delete("header-id");
  maybeUnblockRendering();
</script>
</body>
</html>
```

## Meta Tag with Blocking ElementIds

Add a new meta tag with the name `blocking-elements` and `content` attribute set to the list of [element IDs](https://dom.spec.whatwg.org/#concept-id) which must be parsed before rendering. `*` is a special keyword which implies every element should be blocking.

Each Document has a render-blocking-until-parsed element ids set, initially empty. A Document is [render-blocked](https://html.spec.whatwg.org/#render-blocked) if this set is non-empty.

- If the value of the `content` attribute changes, and the Document [allows adding render blocking elements](https://html.spec.whatwg.org/#allows-adding-render-blocking-elements), the render-blocking-until-parsed element ids is set to the new attribute value.
   This means authors can run script to configure the list until the opening `<body>` tag is parsed (after which no new render blocking resources can be added).

- If the value of the `content` attribute changes, and the Document **does not** [allow adding render blocking elements](https://html.spec.whatwg.org/#allows-adding-render-blocking-elements), render-blocking-until-parsed element ids is set to be an intersection of the existing value and the new attribute value.
   This means authors can run script to remove render-blocking elements after the body tag is parsed but can't add more elements. This allows authors to implement their own timeout if needed.

- Each time an element's ID value changes, the browser checks if the set of elements which have been completely parsed (i.e. the end tag has been parsed) include all IDs in the render-blocking-until-parsed element ids set. If yes, the render-blocking-until-parsed element ids set is cleared.

The pro of this approach is that its easier to block on a specific set of elements, which makes it more likely that authors will consider partial blocking. The con is new syntax which requires defining subtle interactions (like script changing element IDs after parsing).

### Including Blocking Tokens
A sub-proposal is for the `content` attribute to include both the list of element IDs and [blocking tokens](https://html.spec.whatwg.org/#possible-blocking-token). This would enable authors to specify which operation needs to be blocked on a set of elements, similar to controlling which operations are blocked on a particular resources. For example,

```html
<meta name="blocking-elements" content="id1,id2;render">
```

### Sample Code

#### Block Rendering on Full Document Parsing

```html
<html>
<meta name="blocking-elements" content="*">
<body>
…
</body>
</html>
```

#### Block Rendering on Partial Document Parsing

```html
<html>
<meta id="foo" name="blocking-elements" content="">
<script>
  // The value returned by getState() is set by the old Document in
  // the `navigate` event. It tracks whether the old Document add a
  // `view-transition-name` to the header.
  if (navigation.initialLoad.from().getState().morphHeader) {
    foo.content="header-id";
  }
</script>
<body>
…
<div id="header-id">
  ...
</div>
<!--Rendering is unblocked after this point-->
</body>
</html>
```

# Transition Only Blocking

A completmentory proposal (which works with both options above) is to add `transition` to the list of [possible blocking tokens](https://html.spec.whatwg.org/#possible-blocking-token). This token makes the resource, or parsing, render-blocking only if there is a ViewTransition to this Document. This allows authors to limit render-blocking to when its strictly needed.

We could also make `transition` to be the only value allowed for `blocking` in the options above. This means authors won't be able to block rendering on parsing unless there is a ViewTransition.
