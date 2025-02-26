## Layered capture

### Overview
The current mode in which elements are captured for a view transition is "flat": the element's contents are snapshotted in to a bitmap/texture, and its geometry is animated as part of the group.
This is simple and performant, and works well for many use cases. However:
- It does not satisfy all the expression opportunities, such as animating borders or filters.
- It does not work correctly with nested view transitions, because things like backgrounds, clipping and opacity would appear "behind" the nested elements instead of operating on them as a tree.

To augment this, we propose to enable a "layered capture" mode:
- The element's effect, box decorations, box model and overflow are copied to the group and animate as CSS properties.
- The element's content, as well as its descendants that are not in themselves view-transition elements, are considered "content" and are flattened like before.

### Affected Properties
This means that the following CSS properties are animated as part of the group, but not captured into the snapshot:
* Box decorations:
	- 'background'
  - 'border'
  - 'border-radius'
	- 'border-image'
	- 'outline'
	- 'box-shadow'
* Tree effects:
	- 'clip-path'
	- 'filter'
	- 'mask'
	- 'opacity'
* Box model:
	- 'box-sizing'
  - 'padding'

When using this new capture modes, a group that nests other group can, for example, clip them with a `border-radius`, and animate its border-radius while its nested elements animate.

### Is layered *always* better?
In short, no. Layered works best for animations that superimpose the two states on top of each other and animate them as if they were one morphing element.
For other animations, like slide animations (see the header in [this demo](https://live-transitions.pages.dev/), layered capture doesn't make sense and might look odd. Having the two layers as content often makes more sense in that case.

In addition, when the two states are very different, layered animation might result in discrete animations (e.g. between a circle and a square `clip-path`), which would feel less smooth than crossfade.

### Backwards compatibility & opting in/out
Backwards compatibility analysis using the HTTP archive and trying some sites with the new mode shows that very few pages would be affected by this, as the vast majority relies on the default transition.
However, any slide transition would feel a bit broken (like the demo above). That's because the `::view-transition-group` pseudo-element now has reach animations that weren't there before, and customizations that rely on
changing its keyframes or its descendant keyframes would create a very different effect than before.

There are 3 ways to go about this:
- Have only layered capture. Authors can achieve flat capture by creating a container and making their current participating element into "content" which would still be flattened.
- Add a new pseudo-element that animates the effects and box decorations, and leave the `::view-transition-group` as is. This would also simplify things for people who want to play only with geometry and not with the effects.
- Expose a property that opts in or out to this new behavior.

### Geometry
Apart from the above properties, the pseudo-elements are modified to make them display the layered content/style correctly:
- The element's `content-box` is used for the purpose of projecting the snapshot instead of its `border-box`. That way it is affected by the newly animating padding and borders.
- For the same reason, the `::view-transition-image-pair` element now has `position: relative` so that the group content is affected by `padding`.
- The group's width/height are determined based on the originating element's `box-sizing`.
- Nested group transforms is computed based on the padding edge, to position them in the right place.
- Elements with `overflow: clip` would have that property copied over, including implicit clip like `contain: paint`.

### Open issues
- What should be the opt-in/opt-out model etc? Should we just change the current thing and rely on DOM? Add a CSS property? What's the default?
- What happens to scrollbars? Are they content (and would thus appear behind nested elements)? If they are captured, the scroll position will change during the animation... What's the best model?

## Status
Currently due to the open issues and the complexity this adds to developers using this feature, layered capture is not actively pursued.
This means that in order to use nested view transitions, the developers would have to manually copy over the relevant CSS properties themselves.





