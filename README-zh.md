# 失落的方舟 - 方舟棋盘战斗力优化器

一个玩家自制的工具，用于优化失落的方舟中的方舟棋盘护石配置，以最大化战斗力。

## 功能

1. **护石识别**：通过屏幕共享自动识别游戏中的护石
2. **战斗力优化**：智能计算最佳护石配置
3. **多语言支持**：支持韩语、英语和中文界面
4. **配置管理**：保存和管理多个角色配置
5. **结果预览**：查看优化后的战斗力提升和护石配置

## 使用方法

### 1. 准备工作
- 打开失落的方舟游戏
- 进入角色的方舟棋盘界面
- 切换到未使用的预设以卸下所有护石

### 2. 开始使用
1. 在浏览器中打开此工具
2. 点击 [🖥️ 开始屏幕共享] 按钮，选择失落的方舟游戏窗口
3. 向下滚动游戏中的护石列表，工具会自动识别所有护石
4. 确认所有护石都已识别后，点击 [✅ 应用到当前配置]
5. 进入优化设置页面，调整核心最小点数
6. 点击 [执行优化] 按钮，等待计算完成
7. 查看优化结果和建议

## 常见问题

### Q: 屏幕共享失败或被拒绝
A: 请使用 Chrome 或 Edge 浏览器，并确保已授予屏幕共享权限。

### Q: 护石没有被识别
A: 请检查以下内容：
- 游戏分辨率设置为 1920x1080 (16:9)
- 游戏窗口处于窗口模式
- 没有使用强制 21:9 宽高比
- 护石列表完全可见，没有被其他 UI 遮挡

### Q: 优化结果不理想
A: 尝试调整核心最小点数设置，或确保所有护石都已正确识别。

## 技术栈

- **求解器**: 带有上界剪枝的自定义回溯算法 (TypeScript)
- **前端**: Svelte (基于组件的 UI，本地状态持久化)
- **图像处理**: OpenCV (模板匹配，Web Worker)
- **部署**: GitHub Pages (纯客户端)

## 技术细节

- [求解算法](docs/algorithm.md)
- [屏幕识别](docs/opencv.md)

## 如何运行

### 安装

使用 pnpm 安装依赖：

```bash
pnpm install
```

### 生成 OpenCV 精灵图

OpenCV 模板位于 `opencv-templates/` 目录下。运行以下命令将它们合并为一个精灵图：

```bash
pnpm run generate:sprite
```

生成的精灵图坐标将保存在 `lib/opencv-template-coords/` 目录中：

```typescript
// THIS FILE IS AUTO-GENERATED. DO NOT MODIFY ITSELF
export const koKrCoords = {
  ...
  'anchor.png': { x: 0, y: 0, w: 148, h: 36 },
  'lv1.png': { x: 166, y: 138, w: 7, h: 13 },
  'lv2.png': { x: 166, y: 123, w: 9, h: 13 },
  ...
}
```

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过以下方式联系：
- Discord: [链接](https://discord.gg/your-server)
- KakaoTalk: [链接](https://open.kakao.com/your-channel)

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**: 这是一个非官方工具，与 Smilegate RPG 或 Amazon Games 无关。