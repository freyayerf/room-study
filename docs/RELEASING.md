# 发布手册 / Release runbook

## 首次发布 / Initial setup

仓库名称默认 `freyayerf/room-study`。如果 fork 或更名，请更新两个 README 的仓库、Pages 和下载链接。

```sh
gh auth login --hostname github.com --git-protocol ssh --web --skip-ssh-key
gh repo create freyayerf/room-study --public --source=. --remote=origin --push
gh api --method POST repos/freyayerf/room-study/pages -f build_type=workflow
```

若 API 已报告 Pages 存在，检查 Settings → Pages → Build and deployment，Source 应为 **GitHub Actions**。仓库 Settings → Actions 必须允许运行工作流。站点部署使用 `github-pages` environment；有环境审批规则时，按仓库设置批准部署。

首次推送可能先于 Pages 设置完成。启用后可在 Actions → Verify and deploy 手动运行一次，或执行：

```sh
gh workflow run ci.yml --ref main
gh run list --workflow ci.yml --limit 5
```

公开代码与站点前，检查提交清单中没有个人户型、原始参考图片、凭证或本地路径。不要把已有私人方案批量复制到 `examples/`。

## 每次发布 / Versioned release

1. 在分支修改代码与必要回归测试，更新 `CHANGELOG.md`。
2. `npm version 1.0.1 --no-git-tag-version` 同步 `package.json` 和锁文件；版本号按实际改动选择。
3. 执行完整验证：

```sh
npm ci
npx playwright install chromium firefox webkit
npm run release:check
```

4. PR 合入 `main`，等待验证和 Pages 部署通过。
5. 在最新的干净 `main` 上创建与 package version **完全一致**的标签：

```sh
git switch main
git pull --ff-only
git tag -a v1.0.1 -m 'Room Study v1.0.1'
git push origin v1.0.1
```

6. `release.yml` 会验证标签格式、版本、提交是否位于 `main` 历史内；重新运行完整检查和浏览器测试，然后生成 Release 附件：

```text
room-study-v1.0.1.html   单文件离线版
room-study-v1.0.1.zip    离线网页、说明、示例、LICENSE
SHA256SUMS.txt           SHA-256 校验和
```

自动发布使用 GitHub 内置的 `GITHUB_TOKEN`，无需添加私人 token。Release job 只获得 `contents: write`，Pages 部署只在单独 job 获得 Pages/OIDC 权限。外部 PR 不会执行发布。依赖更新由 Dependabot 提交，Action 固定为完整 SHA。

标签工作流若测试失败，不会创建 Release。修复代码、更新补丁版本并创建新标签；不要移动已经发布的标签。若创建 Release 后上传失败，可以重新运行失败 job，已有 release 的附件会被同版本产物覆盖；不改变已发布标签的提交。

## 验证与回滚 / Verify and roll back

- 打开 Pages URL，用无痕窗口确认矩形尺寸、家具摆放、保存、JSON 和 SVG 下载。
- 下载 Release HTML，断网双击打开并验证 Help 和导出。
- 在 macOS/Linux 用 `shasum -a 256 -c SHA256SUMS.txt` 校验；Windows 用 `Get-FileHash -Algorithm SHA256` 对照。
- Pages 回滚：在 `main` 上 `git revert` 引入故障的提交并推送；验证通过后自动部署。保留历史便于审计。
- Release 出错：修复后发布新的 patch 版本，在有问题的 release notes 中说明。不要直接删除用户的本地方案或清空浏览器数据。

## 官方参考 / References

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub CLI releases](https://cli.github.com/manual/gh_release_create)
