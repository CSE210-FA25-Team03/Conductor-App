import os
import time
import requests
from urllib.parse import urlparse


GITHUB_API_BASE = "https://api.github.com"


class GitHubAPIError(Exception):
    pass


class GitHubRepoStats:
    """
    Backend helper for talking to GitHub API and aggregating data
    for a single repository.
    """

    def __init__(self, repo_identifier: str, token: str | None = None):
        """
        repo_identifier: either "owner/repo" or a full GitHub URL.
        token: GitHub personal access token (optional but recommended).
        """
        self.owner, self.repo = self._parse_repo_identifier(repo_identifier)
        self.base_url = f"{GITHUB_API_BASE}/repos/{self.owner}/{self.repo}"
        self.session = requests.Session()

        token = token or os.getenv("GITHUB_TOKEN")
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})

        self.session.headers.update({"Accept": "application/vnd.github+json"})

    # ------------------ Public entrypoints ------------------ #

    def fetch_all_stats(self) -> dict:
        """
        Fetches lots of information and aggregates it by GitHub username.

        Returns:
            {
              "username": {
                "name": str | None,
                "total_commits": int,
                "total_additions": int,
                "total_deletions": int,
                "issues_opened": int,
                "issues_closed": int,
                "issues_assigned": int,
                "pulls_opened": int,
                "pulls_merged": int,
                "pull_reviews": int,
                "review_comments": int,
                "issue_comments": int,
              },
              ...
            }
        """
        contributors_stats = self._get_contributor_stats()
        issues = self._get_all_issues()
        pulls = self._get_all_pull_requests()
        issue_comments = self._get_all_issue_comments()
        review_comments = self._get_all_review_comments()
        reviews_by_pr = self._get_all_pr_reviews()

        # Start building a structure per user
        users: dict[str, dict] = {}

        def ensure_user(username: str) -> dict:
            if username not in users:
                users[username] = {
                    "name": None,
                    "total_commits": 0,
                    "total_additions": 0,
                    "total_deletions": 0,
                    "issues_opened": 0,
                    "issues_closed": 0,
                    "issues_assigned": 0,
                    "pulls_opened": 0,
                    "pulls_merged": 0,
                    "pull_reviews": 0,
                    "review_comments": 0,
                    "issue_comments": 0,
                }
            return users[username]

        # --- Commits / additions / deletions (from /stats/contributors) --- #
        for contributor in contributors_stats:
            author = contributor.get("author")
            if not author:
                continue
            username = author.get("login")
            if not username:
                continue

            u = ensure_user(username)
            u["name"] = author.get("name") or u["name"]

            total_commits = contributor.get("total", 0)
            additions = sum(week.get("a", 0) for week in contributor.get("weeks", []))
            deletions = sum(week.get("d", 0) for week in contributor.get("weeks", []))

            u["total_commits"] += total_commits
            u["total_additions"] += additions
            u["total_deletions"] += deletions

        # --- Issues (including ones that are actually PRs) --- #
        for issue in issues:
            if "pull_request" in issue:
                # This is a PR, skip from issue stats
                continue

            creator = issue.get("user", {}).get("login")
            if creator:
                u = ensure_user(creator)
                u["issues_opened"] += 1

            if issue.get("state") == "closed" and issue.get("closed_by"):
                closer = issue["closed_by"].get("login")
                if closer:
                    u = ensure_user(closer)
                    u["issues_closed"] += 1

            for assignee in issue.get("assignees", []):
                username = assignee.get("login")
                if username:
                    u = ensure_user(username)
                    u["issues_assigned"] += 1

        # --- Pull Requests --- #
        pr_by_number = {pr["number"]: pr for pr in pulls}

        for pr in pulls:
            creator = pr.get("user", {}).get("login")
            if creator:
                u = ensure_user(creator)
                u["pulls_opened"] += 1

            if pr.get("merged_at"):
                merger = pr.get("merged_by", {}).get("login") or creator
                if merger:
                    u = ensure_user(merger)
                    u["pulls_merged"] += 1

        # --- Issue comments (on issues & PRs) --- #
        for comment in issue_comments:
            user = comment.get("user") or {}
            username = user.get("login")
            if username:
                u = ensure_user(username)
                u["issue_comments"] += 1

        # --- Review comments on PR diffs --- #
        for comment in review_comments:
            user = comment.get("user") or {}
            username = user.get("login")
            if username:
                u = ensure_user(username)
                u["review_comments"] += 1

        # --- Reviews (approve / request changes / comment) --- #
        for pr_number, reviews in reviews_by_pr.items():
            for review in reviews:
                user = review.get("user") or {}
                username = user.get("login")
                if username:
                    u = ensure_user(username)
                    u["pull_reviews"] += 1

        return users

    # ------------------ Low-level API helpers ------------------ #

    def _parse_repo_identifier(self, repo_identifier: str) -> tuple[str, str]:
        # Accept "owner/repo" OR "https://github.com/owner/repo"
        if repo_identifier.startswith("http://") or repo_identifier.startswith("https://"):
            parsed = urlparse(repo_identifier)
            parts = parsed.path.strip("/").split("/")
            if len(parts) < 2:
                raise ValueError(f"Could not parse owner/repo from URL: {repo_identifier}")
            return parts[0], parts[1]
        else:
            parts = repo_identifier.strip().split("/")
            if len(parts) != 2:
                raise ValueError('Repo must be "owner/repo" or GitHub URL')
            return parts[0], parts[1]

    def _request(self, method: str, url: str, params: dict | None = None) -> requests.Response:
        resp = self.session.request(method, url, params=params)
        if resp.status_code == 403 and "rate limit" in resp.text.lower():
            raise GitHubAPIError("Hit GitHub API rate limit. Set GITHUB_TOKEN env var.")
        if resp.status_code == 404:
            raise GitHubAPIError(f"Repo {self.owner}/{self.repo} not found.")
        if not resp.ok:
            raise GitHubAPIError(f"GitHub API error: {resp.status_code} {resp.text[:200]}")
        return resp

    def _paginate(self, path: str, params: dict | None = None):
        """
        Generator that yields JSON items across paginated responses.
        """
        url = f"{self.base_url}{path}"
        params = params or {}
        params.setdefault("per_page", 100)

        while url:
            resp = self._request("GET", url, params=params)
            data = resp.json()
            if isinstance(data, list):
                for item in data:
                    yield item
            else:
                # Sometimes GitHub returns dict instead of list; just yield that
                yield data

            # Parse "Link" header for 'next'
            link = resp.headers.get("Link", "")
            next_url = None
            if link:
                parts = link.split(",")
                for part in parts:
                    section = part.split(";")
                    if len(section) == 2:
                        link_url = section[0].strip(" <>")
                        rel = section[1].strip()
                        if rel == 'rel="next"':
                            next_url = link_url
                            break
            if next_url:
                url = next_url
                params = {}  # after first call, params are encoded in URL
            else:
                url = None

    # ------------------ Specific data fetchers ------------------ #

    def _get_contributor_stats(self) -> list[dict]:
        """
        Uses /stats/contributors, which may return 202 while stats are being generated.
        We'll retry a few times.
        """
        url = f"{self.base_url}/stats/contributors"

        for attempt in range(6):  # up to ~30 seconds
            resp = self.session.get(url)
            if resp.status_code == 202:
                # GitHub is computing stats
                time.sleep(5)
                continue
            if not resp.ok:
                raise GitHubAPIError(
                    f"Error getting contributor stats: {resp.status_code} {resp.text[:200]}"
                )
            data = resp.json()
            if isinstance(data, list):
                return data
            return []
        # If still no data, fall back to empty list
        return []

    def _get_all_issues(self) -> list[dict]:
        """
        Returns all issues (state=all). Note: includes PRs; we filter them later.
        """
        issues = list(self._paginate("/issues", {"state": "all"}))
        # Some responses may be dict if repo is empty; normalize
        if issues and isinstance(issues[0], dict):
            return issues
        return []

    def _get_all_pull_requests(self) -> list[dict]:
        """
        Returns all pull requests (state=all).
        """
        return list(self._paginate("/pulls", {"state": "all"}))

    def _get_all_issue_comments(self) -> list[dict]:
        """
        Issue comments across the repo.
        Note: includes comments on PRs as well.
        """
        return list(self._paginate("/issues/comments"))

    def _get_all_review_comments(self) -> list[dict]:
        """
        Review comments on PR diffs.
        """
        return list(self._paginate("/pulls/comments"))

    def _get_all_pr_reviews(self) -> dict[int, list[dict]]:
        """
        Fetch all reviews per PR.
        Returns: { pr_number: [review, ...], ... }
        """
        result: dict[int, list[dict]] = {}
        pulls = self._get_all_pull_requests()
        for pr in pulls:
            number = pr.get("number")
            if not number:
                continue
            url = f"{self.base_url}/pulls/{number}/reviews"
            resp = self._request("GET", url)
            reviews = resp.json()
            if isinstance(reviews, list):
                result[number] = reviews
        return result
