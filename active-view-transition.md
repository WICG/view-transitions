### `activeViewTransition` explainer

#### Motivation & Proposal

View Transitions API allows developers to start visual transitions between
different states. The primary SPA entry point to this is `startViewTransition()`
which returns a transition object. This object contains several promises and
functionality to track the transition progress, as well as allow manipulations
such as skipping the transition or modifying its types.

The proposal here is ergonomic in nature: instead of requiring that users store
this object in some sort of way for easy access, provide a
`document.activeViewTransition` property that represents this object, or null if
there is no transition ongoing.

Note this similarly applies to MPA transitions, where the object is only
available via `pageswap` and `pagereveal` events. In this proposal
`document.activeViewTransition` would be set to this object for the duration of
the transition.

#### Example

```js
<script>
    requestAnimationFrame(() => document.startViewTransition());

    button.addEventListener("click", () => {
        if (document.activeViewTransition) {
            document.activeViewTransition.skipTransition();
        }
    });
</script>
```

#### Alternatives considered

The alternative option to this is to let the developer keep track of the
transitions that they start. However, due to potential complexity in the web
app, including layers of components, we suspect that this addition is an
ergonomic improvement that does not complicate the API.
