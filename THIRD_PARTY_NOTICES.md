# 第三方声明 / Third-Party Notices

本文件列出 Timelog 分发物中使用的主要第三方组件及其许可证。
完整依赖树见 `frontend/package-lock.json` 与 `src-tauri/Cargo.lock`。

更新日期：2026-11-12

## 前端运行时依赖

| 组件 | 版本 | 许可证 | 主页 |
|------|------|--------|------|
| Vue | 3.5.39 | MIT | https://vuejs.org |
| Pinia | 2.3.1 | MIT | https://pinia.vuejs.org |
| html2canvas | 1.4.1 | MIT | https://html2canvas.hertzen.com |
| @tauri-apps/api | 2.11.1 | MIT 或 Apache-2.0 | https://tauri.app |
| @tauri-apps/plugin-dialog | 2.7.1 | MIT 或 Apache-2.0 | https://tauri.app |
| @tauri-apps/plugin-fs | 2.5.1 | MIT 或 Apache-2.0 | https://tauri.app |

开发依赖（Vite、Vitest、ESLint、jsdom 等）不随安装包分发。

## Rust 直接依赖

| 组件 | 版本 | 许可证 |
|------|------|--------|
| tauri | 2.11.5 | MIT 或 Apache-2.0 |
| tauri-build | 2.6.3 | MIT 或 Apache-2.0 |
| tauri-plugin-dialog | 2.7.1 | MIT 或 Apache-2.0 |
| tauri-plugin-fs | 2.5.1 | MIT 或 Apache-2.0 |
| tauri-plugin-opener | 2.5.4 | MIT 或 Apache-2.0 |
| tauri-plugin-process | 2.3.1 | MIT 或 Apache-2.0 |
| tauri-plugin-single-instance | 2.4.3 | MIT 或 Apache-2.0 |
| tauri-plugin-updater | 2.10.1 | MIT 或 Apache-2.0 |
| tauri-plugin-window-state | 2.4.1 | MIT 或 Apache-2.0 |
| reqwest | 0.12.28 | MIT 或 Apache-2.0 |
| serde | 1.0.228 | MIT 或 Apache-2.0 |
| serde_json | 1.0.150 | MIT 或 Apache-2.0 |
| base64 | 0.22.1 | MIT 或 Apache-2.0 |
| windows | 0.58.0 | MIT 或 Apache-2.0 |

## 传递依赖（Rust）

`Cargo.lock` 解析出的约 500 个 crate 以 MIT / Apache-2.0 双许可为主，另有：

- BSD-3-Clause：`brotli`、`brotli-decompressor`、`subtle`、`alloc-no-stdlib`、`alloc-stdlib`
- Zlib：`foldhash`，以及 `bytemuck`、`tinyvec` 等（多许可，可选 Zlib）
- Unicode-3.0：ICU4X 系列（`icu_*`、`zerovec`、`yoke` 等）
- Unlicense 或 MIT：`memchr`、`byteorder`、`walkdir`、`aho-corasick` 等
- MPL-2.0：`cssparser`、`cssparser-macros`、`selectors`、`dtoa-short`、`option-ext`
  - 未对这些文件做修改；其源码可从 crates.io 或对应仓库获取：
    - https://github.com/servo/rust-cssparser
    - https://github.com/servo/stylo （selectors）
    - https://github.com/rust-lang/dtoa-short
    - https://github.com/rust-lang/option-ext

各组件的完整许可证原文随其源码发布，可从 crates.io 对应版本获取，或在本地执行
`cargo metadata` / 查看 `~/.cargo/registry/src/` 下的 crate 目录。

## 素材

- 赞赏卡片 UI：基于 Marcelo Dolza（Uiverse.io）的作品改写，MIT License
  https://uiverse.io/marcelodolza/fluffy-panda-74
- 出票按钮 UI：基于 cssbuttons-io（Uiverse.io）的作品改写，MIT License
  https://uiverse.io/cssbuttons-io/massive-mayfly-74
- 部分界面图标：阿里巴巴矢量图标库（Iconfont），版权归各原作者所有
  https://www.iconfont.cn
- 赞赏二维码：由本项目作者提供

## 许可证原文

- MIT License：https://opensource.org/license/mit
- Apache License 2.0：https://www.apache.org/licenses/LICENSE-2.0
- BSD 3-Clause：https://opensource.org/license/bsd-3-clause
- Mozilla Public License 2.0：https://www.mozilla.org/MPL/2.0/
- Unicode License v3：https://www.unicode.org/license.txt
- Zlib License：https://opensource.org/license/zlib
