#!/usr/bin/env python3
import os
import sys
import argparse

def search_wiki(wiki_dir, query):
    results = []
    for root, _, files in os.walk(wiki_dir):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if query.lower() in content.lower():
                        results.append(path)
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search the wiki for a query.")
    parser.add_argument("query", help="The text to search for")
    parser.add_argument("--wiki-dir", default="wiki", help="Path to the wiki directory")
    args = parser.parse_args()

    results = search_wiki(args.wiki_dir, args.query)
    if results:
        print(f"Found '{args.query}' in:")
        for r in results:
            print(f"  - {r}")
    else:
        print(f"No results found for '{args.query}' in {args.wiki_dir}/")
