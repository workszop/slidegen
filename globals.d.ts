// Ambient globals for the UMD classic scripts under `tsc --checkJs`.
// These three files are self-contained pure logic (no DOM); they need the
// Node-interop names their UMD wrappers reference, plus the browser-attached
// exports other files would otherwise reach through the load order.
declare const module: { exports: any };
declare function require(id: string): any;
declare var DeckModel: any;
declare var marked: any;
