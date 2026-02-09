# Contributing to The Call Floor

First off, thank you for considering contributing to The Call Floor! 🎉

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. By participating, you are expected to uphold this commitment.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When creating a bug report, include:
- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs what actually happened
- **Screenshots** if applicable
- **Browser and OS** information

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:
- **Use a clear title** that describes the suggestion
- **Provide a detailed description** of the proposed feature
- **Explain why** this enhancement would be useful
- **Include mockups** if applicable

### 🔧 Pull Requests

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/amazing-feature`)
3. **Make your changes** and test thoroughly
4. **Commit** with clear messages (`git commit -m 'Add amazing feature'`)
5. **Push** to your branch (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/TheCallFloor.git

# Navigate to project directory
cd TheCallFloor

# Start local server
python -m http.server 8080

# Open in browser
# http://localhost:8080
```

## Code Style

- Use **meaningful variable names**
- Add **comments** for complex logic
- Keep functions **focused and small**
- Use **consistent indentation** (2 spaces for JS)

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | UI, styles, HTML structure |
| `game.js` | All game logic, 3D scene, mechanics |
| `three.min.js` | Three.js library (don't modify) |

## Areas to Contribute

### Beginner Friendly 🌱
- Fix typos in UI text
- Improve tooltip descriptions
- Add new loading tips
- UI color adjustments

### Intermediate 🔧
- New upgrade types
- Balance adjustments
- Sound effects
- Mobile support

### Advanced 🚀
- Performance optimizations
- New 3D models
- Multiplayer features
- Level progression system

## Testing

Before submitting a PR:
1. ✅ Play through the tutorial
2. ✅ Test all 12 upgrades
3. ✅ Check save/load functionality
4. ✅ Verify on multiple browsers

## Questions?

Feel free to open an issue with the "question" label!

---

Thank you for helping make The Call Floor better! 🎮☕
