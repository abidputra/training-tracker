"""
GPX (what Garmin's download returns) -> a small list of [lat, lon, elevation_m].

Pure functions, no network or database, so they are easy to test. A full run
has thousands of points; a phone screen cannot show more than about a
thousand, so the track is thinned evenly (first and last point always kept).
"""
import xml.etree.ElementTree as ET

MAX_POINTS = 1000
MAX_BYTES = 20 * 1024 * 1024  # sanity cap on what we are willing to parse


def _local(tag: str) -> str:
    """'{http://www.topografix.com/GPX/1/1}trkpt' -> 'trkpt'"""
    return tag.rsplit("}", 1)[-1]


def parse_track(data: bytes, max_points: int = MAX_POINTS) -> list[list]:
    """
    Returns [[lat, lon, elevation_or_None], ...] in recording order, thinned to
    at most `max_points`. An activity without GPS gives []. Raises ValueError
    when the data is not usable GPX.
    """
    if len(data) > MAX_BYTES:
        raise ValueError("GPX is too large")
    # A GPX file never needs a DTD. Refusing it closes the XML entity-expansion tricks.
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("GPX contains a DTD")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        raise ValueError(f"not valid XML: {e}") from e

    points: list[list] = []
    for el in root.iter():
        if _local(el.tag) != "trkpt":
            continue
        try:
            lat, lon = float(el.get("lat")), float(el.get("lon"))
        except (TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        ele = None
        for child in el:
            if _local(child.tag) == "ele":
                try:
                    ele = round(float(child.text), 1)
                except (TypeError, ValueError):
                    pass
                break
        points.append([round(lat, 5), round(lon, 5), ele])  # 5 decimals is about 1 m

    return thin(points, max_points)


def thin(points: list[list], max_points: int) -> list[list]:
    """Keeps `max_points` evenly spaced points, always including the first and last."""
    n = len(points)
    if n <= max_points or max_points < 2:
        return points
    step = (n - 1) / (max_points - 1)
    return [points[round(i * step)] for i in range(max_points)]
