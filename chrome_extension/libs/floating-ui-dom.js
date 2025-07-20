"use strict";
Object.defineProperty(exports, "__esModule", {
    value: !0
});
const e = require("@floating-ui/core");
function t(e) {
    return e.split("-")[0];
}
function o(e) {
    return e.split("-")[1];
}
function i(e) {
    return "y" === e ? "height" : "width";
}
function n(e) {
    return [
        "top",
        "bottom"
    ].includes(t(e)) ? "y" : "x";
}
function r(e) {
    return {
        ...e,
        top: e.y,
        left: e.x,
        right: e.x + e.width,
        bottom: e.y + e.height
    };
}
function l(e, t) {
    let { reference: o, floating: i } = e;
    const n = t.getScale(o), l = t.getScale(i), s = o.x + o.width / 2 - i.width / 2, d = o.y + o.height / 2 - i.height / 2;
    return n.x > 0 && n.y > 0 && (s / n.x, d / n.y), l.x > 0 && l.y > 0 && (s * l.x, d * l.y), {
        x: s,
        y: d
    };
}
function s(e) {
    return "number" != typeof e ? function(e) {
        return {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            ...e
        };
    }(e) : {
        top: e,
        right: e,
        bottom: e,
        left: e
    };
}
function d(e) {
    return {
        ...e,
        width: e.right - e.left,
        height: e.bottom - e.top
    };
}
function c(e) {
    const t = getComputedStyle(e);
    return {
        x: parseFloat(t.marginLeft),
        y: parseFloat(t.marginTop)
    };
}
function f(e) {
    return e.ownerDocument ? e.ownerDocument.defaultView : window;
}
function m(e) {
    return f(e).getComputedStyle(e);
}
function u(e) {
    return e instanceof f(e).Node;
}
function g(e) {
    return u(e) ? (e.nodeName || "").toLowerCase() : "";
}
let p;
function h() {
    if (p) return p;
    const e = navigator.userAgentData;
    return e && Array.isArray(e.brands) ? (p = e.brands.map((e)=>e.brand + "/" + e.version).join(" "), p) : navigator.userAgent;
}
function y(e) {
    return e instanceof f(e).HTMLElement;
}
function b(e) {
    return e instanceof f(e).Element;
}
function w(e) {
    return "undefined" != typeof ShadowRoot && e instanceof f(e).ShadowRoot;
}
function v(e) {
    const { overflow: t, overflowX: o, overflowY: i, display: n } = m(e);
    return /auto|scroll|overlay|hidden|clip/.test(t + i + o) && ![
        "inline",
        "contents"
    ].includes(n);
}
function x(e) {
    return [
        "table",
        "td",
        "th"
    ].includes(g(e));
}
function E(e) {
    const t = /firefox/i.test(h()), o = m(e), i = o.position, n = [];
    if ("fixed" === i) return [
        e
    ];
    let r = y(e) && function(e) {
        let t = e;
        for(; y(t) && !S(t);)t = A(t);
        return t;
    }(e);
    for(; y(r) && !S(r);){
        const e = m(r);
        let o = e.transform, l = e.perspective;
        if (o && "none" !== o || l && "none" !== l) return [
            r
        ];
        if (t && "sticky" === e.position) return [
            r
        ];
        r = A(r);
    }
    for(let t = e; y(t) && !S(t);){
        const e = m(t);
        if (t !== r && "static" === e.position && "none" !== e.transform) return n.concat(E(t));
        n.push(t), t = A(t);
    }
    return n;
}
function T(e) {
    return "html" === g(e) || "body" === g(e) && "static" === m(e).position;
}
function S(e) {
    return "html" === g(e);
}
function A(e) {
    if ("html" === g(e)) return e;
    const t = e.assignedSlot || e.parentNode || (w(e) ? e.host : null) || function(e) {
        return e.ownerDocument ? e.ownerDocument.documentElement : document.documentElement;
    }(e);
    return w(t) ? t.host : t;
}
function C(e) {
    const t = A(e);
    return S(t) ? e.ownerDocument ? e.ownerDocument.body : e.body : y(t) && v(t) ? t : C(t);
}
function O(e, t) {
    void 0 === t && (t = []);
    const o = C(e), i = o === (e.ownerDocument ? e.ownerDocument.body : e.body), n = f(o);
    return i ? t.concat(n, n.visualViewport || [], v(o) ? o : []) : t.concat(o, O(o));
}
function D(e, t, o) {
    let i;
    if ("viewport" === t) i = function(e, t) {
        const o = f(e), i = o.visualViewport;
        let n = o.innerWidth, r = o.innerHeight, l = 0, s = 0;
        if (i) {
            n = i.width, r = i.height;
            const e = /firefox/i.test(h());
            if (!e || 1.2 > +e.split("/")[1]) l = i.offsetLeft, s = i.offsetTop;
        }
        return {
            width: n,
            height: r,
            x: l,
            y: s
        };
    }(e, o);
    else if ("document" === t) i = function(e) {
        const t = e.ownerDocument.documentElement, o = L(e), i = t.scrollWidth, n = t.scrollHeight;
        return {
            width: i,
            height: n,
            x: -o.scrollLeft,
            y: -o.scrollTop
        };
    }(function(e) {
        return e.ownerDocument ? e.ownerDocument.documentElement : document.documentElement;
    }(e));
    else if (b(t)) i = function(e, t) {
        const o = k(e), i = L(e), n = t.getScale(e);
        return {
            width: e.clientWidth / n.x,
            height: e.clientHeight / n.y,
            x: -i.scrollLeft / n.x,
            y: -i.scrollTop / n.y
        };
    }(t, o);
    else {
        const e = {
            ...t
        };
        if (f(e.top)) {
            const t = f(e.top);
            e.x = e.left, e.y = e.top, e.width = t.innerWidth, e.height = t.innerHeight;
        }
        i = e;
    }
    return r(i);
}
function L(e) {
    return e === f(e) || !y(e) ? {
        scrollLeft: e.scrollX,
        scrollTop: e.scrollY
    } : {
        scrollLeft: e.scrollLeft,
        scrollTop: e.scrollTop
    };
}
function k(e) {
    return r(e.getBoundingClientRect());
}
function R(e) {
    const t = k(e);
    return t.width = e.offsetWidth, t.height = e.offsetHeight, t.x = e.offsetLeft, t.y = e.offsetTop, t;
}
const M = {
    getClippingRect: function(e) {
        let { element: t, boundary: o, rootBoundary: i, strategy: n } = e;
        const l = "html" === g(t), s = [
            ...("clippingAncestors" === o ? function(e, t) {
                let o = t.get(e);
                if (o) return o;
                let i = O(e).filter((e)=>b(e) && "body" !== g(e)), n = null;
                const r = "fixed" === m(e).position;
                let l = r ? A(e) : e;
                for(; b(l) && !S(l);){
                    const e = m(l);
                    if ("static" === e.position && "none" !== e.transform) {
                        n = l;
                        break;
                    }
                    const t = "fixed" === e.position;
                    if (t) {
                        n = l;
                        break;
                    }
                    l = A(l);
                }
                return r ? i = [] : "sticky" === m(e).position && (i = E(e)), i = i.filter((e)=>e !== n), t.set(e, i), i;
            }(t, this._c) : [].concat(o)),
            i
        ], c = s[0], f = s.reduce((e, o)=>{
            const i = D(t, o, n);
            return e.top = Math.max(i.top, e.top), e.right = Math.min(i.right, e.right), e.bottom = Math.min(i.bottom, e.bottom), e.left = Math.max(i.left, e.left), e;
        }, D(t, c, n));
        return {
            width: f.right - f.left,
            height: f.bottom - f.top,
            x: f.left,
            y: f.top
        };
    },
    convertOffsetParentRelativeRectToViewportRelativeRect: function(e) {
        let { rect: t, offsetParent: o, strategy: i } = e;
        const n = y(o), l = S(o);
        if (o === t) return t;
        let s = {
            scrollLeft: 0,
            scrollTop: 0
        }, d = {
            x: 1,
            y: 1
        };
        const u = {
            x: 0,
            y: 0
        };
        if ((n || !n && "fixed" !== i) && (("body" !== g(o) || v(o)) && (s = L(o)), y(o))) {
            const e = k(o);
            d = this.getScale(o), u.x = e.x + o.clientLeft, u.y = e.y + o.clientTop;
        }
        return {
            width: t.width * d.x,
            height: t.height * d.y,
            x: t.x * d.x - s.scrollLeft * d.x + u.x,
            y: t.y * d.y - s.scrollTop * d.y + u.y
        };
    },
    isElement: b,
    getDimensions: function(e) {
        return y(e) ? function(e) {
            return {
                width: e.offsetWidth,
                height: e.offsetHeight
            };
        }(e) : k(e);
    },
    getOffsetParent: function(e, t) {
        const o = f(e);
        if (!y(e)) return o;
        let i = function(e) {
            let t = A(e);
            for(; y(t) && ![
                "html",
                "body"
            ].includes(g(t));){
                if (v(t) && "static" !== m(t).position) return t;
                t = A(t);
            }
            return null;
        }(e);
        for(; i && x(i) && "static" === m(i).position;)i = A(i);
        return i && ("body" === g(i) && "static" === m(i).position && "static" !== m(e).position || "body" === g(e) && "static" === m(e).position) ? o : i || function(e) {
            let t = A(e);
            for(; y(t) && !S(t);)t = A(t);
            return t;
        }(e);
    },
    getScale: function(e) {
        const t = f(e);
        if (!y(e)) return {
            x: 1,
            y: 1
        };
        const o = k(e), i = t.visualViewport?.width || o.width, n = t.visualViewport?.height || o.height;
        return {
            x: e.offsetWidth > 0 ? Math.round(i) / e.offsetWidth || 1 : 1,
            y: e.offsetHeight > 0 ? Math.round(n) / e.offsetHeight || 1 : 1
        };
    },
    getElementRects: async function(e) {
        let { reference: t, floating: o, strategy: i } = e;
        const n = this.getOffsetParent(o, this._p), l = S(await this.getOffsetParent(o, this._p)), s = "html" === g(n), d = k(t), c = k(o), f = this.getScale(o), m = this.getScale(t);
        let u = c, p = {
            x: 1,
            y: 1
        };
        const h = await this.getOffsetParent(o, this._p);
        if (h !== n) {
            const e = await this.getOffsetParent(o, this._p);
            p = await this.getScale(e);
        }
        if ("absolute" === i) u = R(o);
        else if ("fixed" === i) u = {
            ...c,
            x: c.left,
            y: c.top
        };
        else {
            const e = k(t);
            u = {
                x: e.left,
                y: e.top,
                width: e.width,
                height: e.height
            };
        }
        return {
            reference: {
                ...d,
                x: d.left,
                y: d.top
            },
            floating: u
        };
    },
    isRTL: (e)=>Promise.resolve("rtl" === m(e).direction)
};
Object.defineProperty(exports, "arrow", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "arrow",
                options: r,
                fn(l) {
                    const { element: s, padding: d = 0 } = r || {}, { x: c, y: f, placement: m, rects: u, platform: g, elements: p } = l;
                    if (null == s) return {};
                    const h = "number" != typeof d ? d : {
                        top: d,
                        right: d,
                        bottom: d,
                        left: d
                    }, y = t(m), b = o(m), w = i(y), v = n(m), x = u.reference[w] / 2 - u.floating[w] / 2, E = "y" === v ? "top" : "left", T = "y" === v ? "bottom" : "right", S = u.reference[v] + x, A = u.floating[w], C = u.reference[v] / 2 - A / 2, O = "start" === b ? u.reference[v] / 2 - C : u.reference[v] / 2 + C, D = "start" === b ? h[E] : -h[T], L = S - (O + D), k = c + Math.min(u.reference[w] / 2 - A / 2, L), R = f + Math.min(u.reference[w] / 2 - A / 2, L), M = "y" === v ? k : c, P = "y" === v ? f : R;
                    return {
                        [v]: "y" === v ? P : M,
                        data: {
                            [v]: "y" === v ? P : M,
                            centerOffset: S - ("y" === v ? P : M)
                        }
                    };
                }
            };
        };
    }
}), Object.defineProperty(exports, "autoPlacement", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "autoPlacement",
                options: r,
                fn(l) {
                    const { rects: s, middlewareData: d, placement: c, platform: f, elements: m } = l, { crossAxis: u = !1, alignment: g, allowedPlacements: p = ((e, i)=>{
                        const n = i ? t(e) : e;
                        return [
                            n,
                            ...((e, i)=>i ? [
                                ((e)=>({
                                    top: "bottom",
                                    right: "left",
                                    bottom: "top",
                                    left: "right"
                                }))[e],
                                e
                            ] : [
                                ((e)=>({
                                    left: "right",
                                    right: "left",
                                    top: "bottom",
                                    bottom: "top"
                                }))[e]
                            ])(n)
                        ].flatMap((e)=>i ? [
                                e,
                                `${e}-start`,
                                `${e}-end`
                            ] : [
                                e
                            ]);
                    })(c, null != g), ...h } = r || {}, y = p, b = d.autoPlacement?.placement ?? c, w = (0, e.detectOverflow)({
                        ...l,
                        placement: b
                    }, h).overflows.reduce((e, t)=>{
                        const o = t.direction, i = t.amount;
                        return e[o] = (e[o] || 0) + i, e;
                    }, {});
                    if (!d.autoPlacement) {
                        const t = y.map((t)=>(0, e.detectOverflow)({
                                ...l,
                                placement: t
                            }, h).overflows.reduce((e, t)=>{
                                const o = t.direction, i = t.amount;
                                return e[o] = (e[o] || 0) + i, e;
                            }, {})).map((e, t)=>({
                                placement: y[t],
                                overflows: e
                            })).sort((e, t)=>{
                                const o = Object.values(e.overflows).reduce((e, t)=>e + t, 0), i = Object.values(t.overflows).reduce((e, t)=>e + t, 0);
                                return o - i;
                            })[0];
                        if (t && Object.values(t.overflows).every((e)=>e <= 0)) return {
                            placement: t.placement
                        };
                    }
                    const v = ((e, t, o)=>{
                        const i = e.split("-")[1], n = "y" === (e = t, [
                            "top",
                            "bottom"
                        ].includes(e) ? "y" : "x") ? "y" : "x", r = "y" === n ? o.height : o.width;
                        return {
                            start: {
                                [n]: e = "y" === n ? t : o.x,
                                cross: (i ? -1 : 1) * r
                            },
                            end: {
                                [n]: e,
                                cross: (i ? 1 : -1) * r
                            }
                        };
                    })(b, s.reference, s.floating);
                    if (u) {
                        const e = `${t(b)}-${g ?? (v.start.cross > 0 ? "start" : "end")}`;
                        if (Object.values((0, e.detectOverflow)({
                            ...l,
                            placement: e
                        }, h).overflows).every((e)=>e <= 0)) return {
                            placement: e
                        };
                    }
                    const x = Object.keys(w).sort((e, t)=>w[e] - w[t]), E = x.filter((e)=>"left" === e || "right" === e), T = x.filter((e)=>"top" === e || "bottom" === e), S = {
                        top: "bottom",
                        bottom: "top",
                        left: "right",
                        right: "left"
                    }[T[0]], A = {
                        top: "bottom",
                        bottom: "top",
                        left: "right",
                        right: "left"
                    }[E[0]], C = o(b);
                    let O = b;
                    return "x" === n(b) ? w.left > 0 || w.right > 0 ? O = C ? `${t(b)}-${"start" === C ? "end" : "start"}` : A || t(b) : w.top > 0 || w.bottom > 0 ? O = S || t(b) : void 0 : w.top > 0 || w.bottom > 0 ? O = C ? `${t(b)}-${"start" === C ? "end" : "start"}` : S || t(b) : w.left > 0 || w.right > 0 ? O = A || t(b) : void 0, {
                        placement: O
                    };
                }
            };
        };
    }
}), Object.defineProperty(exports, "computePosition", {
    enumerable: !0,
    get: function() {
        return function(t, o, i) {
            const n = {
                platform: M,
                ...i
            };
            return (0, e.computePosition)(t, o, n);
        };
    }
}), Object.defineProperty(exports, "detectOverflow", {
    enumerable: !0,
    get: function() {
        return e.detectOverflow;
    }
}), Object.defineProperty(exports, "flip", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "flip",
                options: r,
                async fn(l) {
                    const { placement: s, middlewareData: d, rects: c, initialPlacement: f, platform: m, elements: u } = l, { mainAxis: g = !0, crossAxis: p = !0, fallbackPlacements: h, fallbackStrategy: y = "bestFit", fallbackAxisSideDirection: b = "none", ...w } = r || {}, v = t(s), x = t(f), E = o(s), T = o(f), S = [];
                    let A = h;
                    if (!A) {
                        const e = ((e)=>({
                            top: "bottom",
                            right: "left",
                            bottom: "top",
                            left: "right"
                        }))[x];
                        A = x === v ? [
                            ((e, t, o)=>{
                                const i = ((e)=>({
                                    start: "end",
                                    end: "start"
                                }))[e];
                                switch(t){
                                    case "none":
                                        return i;
                                    case "start":
                                        return i;
                                    case "end":
                                        return "start";
                                    default:
                                        return o ? i : "start";
                                }
                            })(T, b, await m.isRTL?.(u.floating)),
                            T
                        ].map((e)=>`${v}-${e}`).filter((e)=>e !== s) : [
                            e
                        ];
                    }
                    const C = await (0, e.detectOverflow)(l, w);
                    if (g) {
                        const t = C[v];
                        if (t > 0) {
                            const o = await (0, e.detectOverflow)({
                                ...l,
                                placement: A[0]
                            }, w), i = o[v];
                            if (i > 0) {
                                if ("bestFit" === y) {
                                    const e = [
                                        {
                                            placement: s,
                                            overflows: C
                                        },
                                        {
                                            placement: A[0],
                                            overflows: o
                                        }
                                    ].sort((e, t)=>{
                                        const o = Object.values(e.overflows).reduce((e, t)=>e + t, 0), i = Object.values(t.overflows).reduce((e, t)=>e + t, 0);
                                        return o - i;
                                    })[0];
                                    S.push(e.placement);
                                }
                            } else S.push(A[0]);
                        }
                    }
                    if (p) {
                        const i = S.length > 0 ? S[0] : s, n = t(i), r = ((e)=>({
                            top: "bottom",
                            right: "left",
                            bottom: "top",
                            left: "right"
                        }))[n], a = `${r}${E ? `-${E}` : ""}`, d = await (0, e.detectOverflow)(l, w), c = d[n];
                        if (c > 0) {
                            const t = await (0, e.detectOverflow)({
                                ...l,
                                placement: a
                            }, w), o = t[n];
                            o <= 0 && S.push(a);
                        }
                    }
                    const O = (d.flip?.placement ?? s) !== s;
                    return S.length > 0 ? {
                        placement: S[0],
                        data: {
                            skip: !0
                        }
                    } : O ? {} : {
                        data: {
                            reset: !0
                        }
                    };
                }
            };
        };
    }
}), Object.defineProperty(exports, "hide", {
    enumerable: !0,
    get: function() {
        return function(t) {
            return {
                name: "hide",
                options: t,
                async fn(o) {
                    const { rects: i } = o, { strategy: n = "referenceHidden", ...r } = t || {}, l = await (0, e.detectOverflow)(o, {
                        ...r,
                        boundary: "clippingAncestors"
                    }), s = l.overflows.filter((e)=>"reference" === e.direction), d = l.overflows.filter((e)=>"floating" === e.direction);
                    switch(n){
                        case "referenceHidden":
                            {
                                const e = s.find((e)=>"x" === e.axis && "y" === e.axis);
                                return {
                                    data: {
                                        referenceHidden: !!e,
                                        referenceHiddenOffsets: e ? e.offsets : {}
                                    }
                                };
                            }
                        case "escaped":
                            {
                                const e = d.find((e)=>"x" === e.axis && "y" === e.axis);
                                return {
                                    data: {
                                        escaped: !!e,
                                        escapedOffsets: e ? e.offsets : {}
                                    }
                                };
                            }
                        case "referenceHidden-escaped":
                        default:
                            return {};
                    }
                }
            };
        };
    }
}), Object.defineProperty(exports, "inline", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "inline",
                options: r,
                async fn(l) {
                    const { placement: s, elements: d, rects: c, platform: f, middlewareData: m } = l, { padding: u = 2, x: g, y: p } = r || {}, h = Array.from(await f.getClientRects?.(d.reference) || []), y = t(s), b = c.floating, w = h.find((e)=>"x" === y ? e.width > b.width - 1 : e.height > b.height - 1) || h.find((e)=>e.width > 0) || h[0], v = {
                        ...c.reference,
                        x: w.x,
                        y: w.y,
                        width: w.width,
                        height: w.height
                    }, x = await (0, e.detectOverflow)({
                        ...l,
                        rects: {
                            ...l.rects,
                            reference: v
                        }
                    }, {
                        padding: u
                    }), E = x.overflows.find((e)=>"x" === e.axis);
                    if (E) {
                        const e = {
                            ...c.reference
                        };
                        let t = e.x, o = e.x + e.width;
                        for (const i of h){
                            if (i.x < t) t = i.x;
                            else if (i.x + i.width > o) o = i.x + i.width;
                        }
                        e.x = t, e.width = o - t;
                        const i = await (0, e.detectOverflow)({
                            ...m,
                            rects: {
                                ...m.rects,
                                reference: e
                            }
                        }, {
                            padding: u
                        });
                        if (i.overflows.length <= 0) return "number" == typeof g || "number" == typeof p ? {
                            x: g,
                            y: p
                        } : {};
                    }
                    return {};
                }
            };
        };
    }
}), Object.defineProperty(exports, "limitShift", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                options: r,
                fn(l) {
                    const { x: s, y: d, placement: c, rects: f, middlewareData: m } = l, { offset: u = 0, mainAxis: g = !0, crossAxis: p = !1 } = r || {}, h = {
                        x: s,
                        y: d
                    }, y = t(c), b = n(y), w = i(b), v = f.reference[w], x = f.reference[b], E = f.floating[w], T = m.offset?.[b] + ("number" == typeof u ? u : u[b] ?? 0) || 0, S = x - T, A = x + v + T, C = h[b] - x;
                    let O = h[b];
                    if (g) {
                        const e = S, t = A - E;
                        O = Math.max(e, Math.min(O, t));
                    }
                    if (p) {
                        const e = "y" === b ? "left" : "top", t = "y" === b ? "right" : "bottom", o = f.reference[e], i = f.reference[t], n = "y" === b ? f.floating.width : f.floating.height, r = h["y" === b ? "x" : "y"], l = o - n, s = i, d = r + (r - o);
                        O = Math.max(l, Math.min(O, s, d));
                    }
                    return {
                        [b]: O
                    };
                }
            };
        };
    }
}), Object.defineProperty(exports, "offset", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "offset",
                options: r,
                async fn(l) {
                    const { x: s, y: d, placement: c, rects: f, platform: m, elements: u } = l, { mainAxis: g = 0, crossAxis: p = 0, alignmentAxis: h } = "function" == typeof r ? r(l) : r, y = t(c), b = o(c), w = f.reference.width, v = f.reference.height, x = f.floating.width, E = f.floating.height;
                    let T = s, S = d;
                    const A = n(y), C = "y" === A ? "vertical" : "horizontal", O = "y" === A ? "height" : "width";
                    if ("mainAxis" === C) {
                        const e = "y" === A ? "top" : "left", t = "y" === A ? "bottom" : "right";
                        T = "y" === A ? T : T + (f.reference[O] / 2 - f.floating[O] / 2), S = "y" === A ? S + (f.reference[O] / 2 - f.floating[O] / 2) : S;
                    } else T = "y" === A ? T : T + (f.reference[O] / 2 - f.floating[O] / 2), S = "y" === A ? S + (f.reference[O] / 2 - f.floating[O] / 2) : S;
                    const D = "y" === A ? v : w, L = "y" === A ? w : v, k = "y" === A ? E : x, R = "y" === A ? x : E;
                    let M = g, P = p;
                    switch(b){
                        case "start":
                            M = "y" === A ? M : M - (L / 2 - R / 2), P = "y" === A ? P - (L / 2 - R / 2) : P;
                            break;
                        case "end":
                            M = "y" === A ? M : M + (L / 2 - R / 2), P = "y" === A ? P + (L / 2 - R / 2) : P;
                    }
                    if (null != h) {
                        const e = "y" === A ? "y" : "x", t = "y" === A ? "x" : "y";
                        "y" === A ? (T = T - P, S = S - M) : (T = T - M, S = S - P), T = "y" === A ? T + h : T, S = "y" === A ? S : S + h;
                    }
                    if (await m.isRTL?.(u.floating)) {
                        const e = "y" === A ? "left" : "top", t = "y" === A ? "right" : "bottom";
                        T = "y" === A ? T : -T;
                    }
                    return "y" === A ? {
                        y: S
                    } : {
                        x: T
                    };
                }
            };
        };
    }
}), Object.defineProperty(exports, "platform", {
    enumerable: !0,
    get: function() {
        return M;
    }
}), Object.defineProperty(exports, "shift", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "shift",
                options: r,
                async fn(l) {
                    const { x: s, y: d, placement: c } = l, { mainAxis: f = !0, crossAxis: m = !1, limiter: u = {
                        fn: (e)=>{
                            let { x: t, y: o } = e;
                            return {
                                x: t,
                                y: o
                            };
                        }
                    }, ...g } = r || {}, p = {
                        x: s,
                        y: d
                    }, h = await (0, e.detectOverflow)(l, g), y = t(c), b = ((e)=>({
                        top: "bottom",
                        right: "left",
                        bottom: "top",
                        left: "right"
                    }))[y], w = n(y);
                    let v = p[w];
                    if (f) {
                        const e = "y" === w ? "top" : "left", t = "y" === w ? "bottom" : "right", o = v + h[e], i = v - h[t];
                        v = Math.max(o, Math.min(v, i));
                    }
                    if (m) {
                        const e = "y" === w ? "left" : "top", t = "y" === w ? "right" : "bottom", o = v + h[e], i = v - h[t];
                        v = Math.max(o, Math.min(v, i));
                    }
                    const x = u.fn({
                        ...p,
                        [w]: v
                    });
                    return {
                        ...x,
                        data: {
                            x: x.x - p.x,
                            y: x.y - p.y
                        }
                    };
                }
            };
        };
    }
}), Object.defineProperty(exports, "size", {
    enumerable: !0,
    get: function() {
        return function(r) {
            return {
                name: "size",
                options: r,
                async fn(l) {
                    const { placement: s, rects: d, platform: c, elements: f } = l, { apply: m, ...u } = r || {}, g = await (0, e.detectOverflow)(l, u), p = t(s), h = n(p), y = i(h), b = d.floating[y], w = {
                        [y]: b - g[p]
                    };
                    return m?.(w), {
                        ...w
                    };
                }
            };
        };
    }
});

 //# sourceMappingURL=floating-ui.dom.js.map
