from pystac_client import Client
import planetary_computer

def handler(event, context):
    client = Client.open("https://planetarycomputer.microsoft.com/api/stac/v1")
    search = client.search(
        collections=["sentinel-2-l2a"],
        bbox=event["bbox"],
        datetime=f"{event['start']}/{event['end']}",
        query={"eo:cloud_cover": {"lt": 80}}
    )
    items = []
    for item in search.items():
        signed = planetary_computer.sign(item)
        items.append({
            "date": item.datetime.strftime("%Y-%m-%d"),
            "B04": signed.assets["B04"].href,
            "B08": signed.assets["B08"].href,
            "field_id": event["field_id"],
            "bbox": event["bbox"]
        })
        if len(items) >= 3: # TESTI: vain 3 päivää
            break
    return {"field_id": event["field_id"], "items": items}  