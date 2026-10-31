"""
Garmin lap and per-km data -> two small lists for the run detail screen.

  laps    what the watch recorded (manual, workout-step and auto laps)
  splits  true kilometre splits, worked out from the activity's time series, so
          they are right even when the watch was not set to auto-lap every 1 km

Pure functions, no network or database, so they are easy to test. Garmin names
the same field differently between endpoints (and a client library may rename
them), so every field is looked up under the names it is known by; anything
missing is skipped rather than guessed.
"""
from __future__ import annotations

KM = 1000.0
# A trailing piece shorter than this is folded into the last full km instead of being listed.
MIN_PARTIAL_M = 500.0
MAX_ROWS = 300  # a sanity cap: a lap-per-100m workout for hours is still far below this


def _num(*values):
    """First value that is a finite number, else None."""
    for v in values:
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float)) and v == v and abs(v) != float("inf"):
            return float(v)
    return None


def _get(d: dict, *names):
    for n in names:
        if n in d and d[n] is not None:
            return d[n]
    return None


def parse_laps(raw: dict | None) -> list[dict]:
    """
    Garmin `splits` response -> [{n, intensity, trigger, dist, time, hr}, ...] in order.
    dist in metres, time in seconds (timer time), hr in bpm (None if unknown).
    """
    if not isinstance(raw, dict):
        return []
    items = _get(raw, "lapDTOs", "laps") or []
    out: list[dict] = []
    for i, lap in enumerate(items[:MAX_ROWS], start=1):
        if not isinstance(lap, dict):
            continue
        dist = _num(_get(lap, "distance", "distance_meters"))
        time = _num(
            _get(lap, "movingDuration", "moving_duration_seconds"),
            _get(lap, "duration", "duration_seconds"),
        )
        # a lap with no distance or time cannot show a pace
        if not dist or dist <= 0 or not time or time <= 0:
            continue
        hr = _num(_get(lap, "averageHR", "avg_hr_bpm"))
        out.append(
            {
                "n": int(_num(_get(lap, "lapIndex", "lap_number")) or i),
                "intensity": str(_get(lap, "intensityType", "intensity_type") or "").upper() or None,
                "trigger": str(_get(lap, "lapTrigger", "lap_trigger") or "").upper() or None,
                "dist": round(dist, 1),
                "time": round(time, 1),
                "hr": round(hr) if hr and hr > 0 else None,
            }
        )
    return out


def _series(details: dict | None) -> dict[str, list]:
    """Garmin `details` response -> {metric key: [value per sample]} (None where a sample has none)."""
    if not isinstance(details, dict):
        return {}
    index = {}
    for d in details.get("metricDescriptors") or []:
        if isinstance(d, dict) and d.get("key") is not None and d.get("metricsIndex") is not None:
            index[d["key"]] = d["metricsIndex"]
    rows = details.get("activityDetailMetrics") or []
    out: dict[str, list] = {}
    for key, i in index.items():
        col = []
        for r in rows:
            m = r.get("metrics") if isinstance(r, dict) else None
            col.append(m[i] if isinstance(m, list) and i < len(m) else None)
        out[key] = col
    return out


def km_splits(details: dict | None) -> list[dict]:
    """
    True per-km splits: [{n, dist, time, hr}, ...]. dist in metres (1000, the last one a bit
    more or less), time in seconds, hr the mean of the samples inside the km (None if none).
    Returns [] when the series has no distance or time (the caller then shows no splits).
    """
    s = _series(details)
    dist = s.get("sumDistance")
    time = None
    for key in ("sumMovingDuration", "sumDuration", "sumElapsedDuration"):
        if s.get(key):
            time = s[key]
            break
    if not dist or not time:
        return []
    hr_col = s.get("directHeartRate") or [None] * len(dist)

    # keep samples where distance and time both exist and distance never goes backwards
    pts: list[tuple[float, float, float | None]] = []
    for d, t, h in zip(dist, time, hr_col):
        d, t = _num(d), _num(t)
        if d is None or t is None:
            continue
        if pts and (d < pts[-1][0] or t < pts[-1][1]):
            continue
        pts.append((d, t, _num(h)))
    if len(pts) < 2:
        return []
    total = pts[-1][0]
    if total < KM * 0.5:
        return []

    def time_at(x: float) -> float:
        """Timer time when the distance reached x metres (linear between samples)."""
        if x <= pts[0][0]:
            return pts[0][1]
        for j in range(1, len(pts)):
            d0, t0, _ = pts[j - 1]
            d1, t1, _ = pts[j]
            if x <= d1:
                return t1 if d1 == d0 else t0 + (t1 - t0) * (x - d0) / (d1 - d0)
        return pts[-1][1]

    full = int(total // KM)
    remainder = total - full * KM
    edges = [i * KM for i in range(0, full + 1)]
    if remainder >= MIN_PARTIAL_M:
        edges.append(total)  # a real partial km at the end
    elif full >= 1:
        edges[-1] = total  # fold a short tail into the last full km
    if len(edges) < 2:
        return []

    out = []
    for i in range(1, min(len(edges), MAX_ROWS + 1)):
        lo, hi = edges[i - 1], edges[i]
        seconds = time_at(hi) - time_at(lo)
        if seconds <= 0:
            continue
        hrs = [p[2] for p in pts if lo <= p[0] <= hi and p[2] and p[2] > 0]
        out.append(
            {
                "n": i,
                "dist": round(hi - lo, 1),
                "time": round(seconds, 1),
                "hr": round(sum(hrs) / len(hrs)) if hrs else None,
            }
        )
    return out


def splits_from_laps(laps: list[dict]) -> list[dict]:
    """
    Fallback when the time series is unavailable: if the watch auto-lapped every km (all laps
    close to 1 km, apart from a shorter last one), those laps ARE the km splits.
    """
    if len(laps) < 1:
        return []
    body = laps[:-1] if len(laps) > 1 else laps
    if not all(abs(l["dist"] - KM) <= 30 for l in body):
        return []
    return [{"n": i, "dist": l["dist"], "time": l["time"], "hr": l["hr"]} for i, l in enumerate(laps, start=1)]
