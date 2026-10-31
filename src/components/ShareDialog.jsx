/**
 * Share dialog for an activity: pick a piece (route map, summary, splits, big
 * numbers...), pick Transparent or Solid, then download the PNG, download both,
 * or copy the image. Phones: a bottom sheet. Desktop: a centred dialog with the
 * preview on the left and the controls on the right.
 *
 * `assets` come from lib/shareArt.js. The preview IS the export: the same canvas,
 * scaled down by CSS.
 */
import { useEffect, useState } from 'react';
import { assetBlob, currentAccent, loadShareFonts, paintAsset } from '../lib/shareArt.js';
import { zip } from '../lib/zip.js';
import Drawer from './Drawer.jsx';
import { Icon } from './ui.jsx';

const NOTES = {
  transparent: 'Transparent PNG: no background, so it sits cleanly on photos and video. Unlit dots stay faintly visible.',
  solid: 'Solid PNG: black background with the dot grid, ready to post as is.',
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ShareDialog({ open, onClose, assets, fileBase }) {
  const [bg, setBg] = useState('transparent');
  const [assetId, setAssetId] = useState(null);
  const [status, setStatus] = useState(null); // short line under the buttons
  const [busy, setBusy] = useState(false);
  // The canvas only exists once the dialog has mounted, so keep the element in state: drawing
  // starts the moment it appears, not at the first render when it is still missing.
  const [canvasEl, setCanvasEl] = useState(null);

  const asset = assets.find((a) => a.id === assetId) ?? assets[0];
  const solid = bg === 'solid';

  // Draw the preview whenever the piece or the background changes (or the dialog opens):
  // at once, then again when the fonts are ready, so it is never blank while they load.
  useEffect(() => {
    if (!open || !asset) return undefined;
    let cancelled = false;
    const draw = () => {
      if (!cancelled && canvasEl) paintAsset(canvasEl, asset, { solid, accent: currentAccent() });
    };
    draw();
    loadShareFonts().then(draw);
    return () => {
      cancelled = true;
    };
  }, [open, asset, solid, canvasEl]);

  useEffect(() => setStatus(null), [asset?.id, bg, open]);

  if (!asset) return null;

  const fileName = (s) => `${fileBase}-${asset.id}-${s ? 'solid' : 'transparent'}.png`;
  const blobFor = async (s) => {
    await loadShareFonts();
    return assetBlob(asset, { solid: s, accent: currentAccent() });
  };

  async function run(fn) {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const download = () => run(async () => save(await blobFor(solid), fileName(solid)));

  const both = () =>
    run(async () => {
      const [t, s] = [await blobFor(false), await blobFor(true)];
      if (window.matchMedia('(min-width: 1024px)').matches) {
        const files = [
          { name: fileName(false), data: new Uint8Array(await t.arrayBuffer()) },
          { name: fileName(true), data: new Uint8Array(await s.arrayBuffer()) },
        ];
        save(new Blob([zip(files)], { type: 'application/zip' }), `${fileBase}-${asset.id}.zip`);
      } else {
        // phones: two separate downloads (a zip is awkward to open there)
        save(t, fileName(false));
        await wait(500);
        save(s, fileName(true));
      }
    });

  const copy = () =>
    run(async () => {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Copying images is not supported here. Download it instead.');
      }
      await loadShareFonts();
      // the promise form keeps Safari happy: the clipboard write starts inside the tap
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': assetBlob(asset, { solid, accent: currentAccent() }) })]);
      setStatus('Image copied.');
    });

  const seg = (key, label) => (
    <button
      key={key}
      aria-pressed={bg === key}
      onClick={() => setBg(key)}
      className={`min-h-12 flex-1 rounded-full border text-[13px] ${
        bg === key ? 'border-accent bg-accent font-bold text-black' : 'border-line-strong text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Share" modal>
      <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        {/* ---- left on desktop: the preview ---- */}
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none">
          <div
            role="img"
            aria-label={`Export preview: ${asset.name}`}
            className="flex h-[308px] w-full flex-none items-center justify-center overflow-hidden rounded-[20px] border border-line p-4 lg:h-[600px] lg:p-7"
            style={{ background: 'conic-gradient(#1A1A1A 25%, #262626 0 50%, #1A1A1A 0 75%, #262626 0) 0 0 / 24px 24px' }}
          >
            <canvas ref={setCanvasEl} className="block h-auto max-h-full w-auto max-w-full" />
          </div>
          <p className="order-3 m-0 text-xs leading-relaxed text-[#b5b5b5] lg:order-none">
            {NOTES[bg]} Exports at {asset.size[0]} × {asset.size[1]} px.
          </p>
        </div>

        {/* ---- right on desktop: the controls ---- */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-[22px]">
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <h2 className="title m-0" style={{ fontSize: 28 }}>
              Share
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-white"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="order-1 flex flex-col gap-2.5 lg:order-none">
            <span className="hidden text-xs tracking-[0.14em] text-[#b5b5b5] uppercase lg:inline">Background</span>
            <div className="flex gap-1.5">
              {seg('transparent', 'Transparent')}
              {seg('solid', 'Solid')}
            </div>
          </div>

          <div className="order-4 flex flex-col gap-2.5 lg:order-none">
            <span className="hidden text-xs tracking-[0.14em] text-[#b5b5b5] uppercase lg:inline">Asset</span>
            {/* phone: a row of cards; desktop: a list */}
            <div role="group" aria-label="Asset" className="no-scrollbar -mx-5 flex flex-none gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0">
              {assets.map((a) => {
                const on = a.id === asset.id;
                return (
                  <button
                    key={a.id}
                    aria-pressed={on}
                    onClick={() => setAssetId(a.id)}
                    className={`flex min-h-16 w-[132px] flex-none flex-col justify-center gap-1 rounded-2xl border px-3.5 py-2.5 text-left text-white lg:min-h-[46px] lg:w-auto lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:px-[18px] lg:py-0 ${
                      on ? 'border-accent bg-[#1a1a1a]' : 'border-line bg-black'
                    }`}
                  >
                    <span className="flex items-center gap-3 text-[13px] lg:text-sm">
                      <span aria-hidden="true" className={`hidden h-2.5 w-2.5 rounded-full lg:inline-block ${on ? 'bg-accent' : 'bg-[#444]'}`} />
                      {a.name}
                    </span>
                    <span className="text-xs text-[#b5b5b5]">
                      {a.size[0]} × {a.size[1]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="order-5 mt-auto flex flex-col gap-2.5">
            <button onClick={download} disabled={busy} className="btn-primary min-h-[52px] w-full text-[13px] lg:text-sm">
              <Icon name="download" />
              Download {solid ? 'Solid' : 'Transparent'} PNG
            </button>
            <div className="flex gap-2.5">
              <button onClick={both} disabled={busy} className="btn flex-1">
                Download both<span className="hidden lg:inline"> (.zip)</span>
              </button>
              <button onClick={copy} disabled={busy} className="btn flex-1">
                Copy image
              </button>
            </div>
            <p role="status" className={`m-0 min-h-4 text-xs ${status ? 'text-white' : ''}`}>
              {status}
            </p>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
