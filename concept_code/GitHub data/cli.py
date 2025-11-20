import argparse
import os
from github_stats import GitHubRepoStats, GitHubAPIError


def format_int(n: int) -> str:
    return f"{n:,}"  # 1234 -> "1,234"


def print_table(stats: dict[str, dict]):
    if not stats:
        print("No stats found (maybe no commits / issues / PRs?).")
        return

    # Decide columns here – you can change these easily later
    headers = [
        "User",
        "Commits",
        "Additions",
        "Deletions",
        "Issues Opened",
        "Issues Closed",
        "Issues Assigned",
        "PRs Opened",
        "PRs Merged",
        "PR Reviews",
        "Review Comments",
        "Issue Comments",
    ]

    # Compute column widths
    rows = []
    for username, data in stats.items():
        row = [
            username,
            format_int(data["total_commits"]),
            format_int(data["total_additions"]),
            format_int(data["total_deletions"]),
            format_int(data["issues_opened"]),
            format_int(data["issues_closed"]),
            format_int(data["issues_assigned"]),
            format_int(data["pulls_opened"]),
            format_int(data["pulls_merged"]),
            format_int(data["pull_reviews"]),
            format_int(data["review_comments"]),
            format_int(data["issue_comments"]),
        ]
        rows.append(row)

    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))

    def print_separator():
        print(
            "+-"
            + "-+-".join("-" * w for w in col_widths)
            + "-+"
        )

    def print_row(cells):
        print(
            "| "
            + " | ".join(str(c).ljust(col_widths[i]) for i, c in enumerate(cells))
            + " |"
        )

    print_separator()
    print_row(headers)
    print_separator()
    for row in rows:
        print_row(row)
    print_separator()


def main():
    parser = argparse.ArgumentParser(
        description="Measure per-user contribution for a GitHub repository."
    )
    parser.add_argument(
        "repo",
        nargs="?",
        help='Repository identifier, e.g. "owner/repo" or "https://github.com/owner/repo"',
    )
    args = parser.parse_args()

    if args.repo:
        repo_identifier = args.repo
    else:
        # 👉 This is where you PASTE the GitHub link if you don't pass it as an argument
        repo_identifier = input(
            'Enter repo (e.g. "owner/repo" or "https://github.com/owner/repo"): '
        ).strip()

    token_present = bool(os.getenv("GITHUB_TOKEN"))
    if not token_present:
        print(
            "Warning: GITHUB_TOKEN is not set. You may hit rate limits for non-trivial repos.\n"
            "Set it with: export GITHUB_TOKEN='your_token_here'"
        )

    try:
        backend = GitHubRepoStats(repo_identifier)
        print(f"Fetching stats for {backend.owner}/{backend.repo} ...")
        stats = backend.fetch_all_stats()
        print_table(stats)
    except GitHubAPIError as e:
        print(f"GitHub API error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    main()





export GITHUB_TOKEN="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"
