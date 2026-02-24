#!/usr/bin/env python3
"""
Mark the last N lots in real_lots.json as synthetic test data.
This helps exclude test data from statistics and analytics.
"""
import json
import sys

def mark_synthetic_lots(num_lots: int = 22):
    """Mark the last num_lots as synthetic"""
    json_file = "/Users/beka/Projects/claude/goszakup-ai/data/raw/real_lots.json"
    
    with open(json_file, "r", encoding="utf-8") as f:
        lots = json.load(f)
    
    print(f"Total lots before: {len(lots)}")
    print(f"Marking last {num_lots} lots as synthetic test data...")
    
    # Mark the last N lots as synthetic
    for i in range(max(0, len(lots) - num_lots), len(lots)):
        lots[i]["is_synthetic"] = True
        print(f"  ✓ {lots[i]['lot_id']}: {lots[i]['name_ru']}")
    
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(lots, f, ensure_ascii=False, indent=2)
    
    synthetic_count = sum(1 for lot in lots if lot.get("is_synthetic", False))
    print(f"\n✅ Marked {synthetic_count} synthetic lots")
    print(f"Total real lots: {len(lots) - synthetic_count}")
    print(f"Total synthetic: {synthetic_count}")

if __name__ == "__main__":
    num = int(sys.argv[1]) if len(sys.argv) > 1 else 22
    mark_synthetic_lots(num)
