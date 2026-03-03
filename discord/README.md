# ANGEL Discord Bot - Quick Reference

## 🚀 Fast Start

```bash
# 1. Copy .env.example to .env
cp .env.example .env

# 2. Edit .env with your Discord token
nano .env

# 3. Start bot
npm start
```

Your bot will register commands automatically!

---

## 📱 Commands (Use / in Discord)

### 📊 Status
- `/angel-status` → See money rate, XP, hack level, memory
- `/angel-modules` → All modules at a glance
- `/angel-health` → System health check

### 💰 Income
- `/angel-income` → Breakdown of money sources
- `/angel-performance` → Efficiency metrics

### 📈 Reports
- `/angel-report` → Full telemetry report
- `/angel-uptime` → Session duration
- `/angel-targets` → Current hack targets

### ⚡ Control
- `/angel-pause` → Stop Angel
- `/angel-resume` → Start Angel
- `/angel-restart-module hacking` → Restart specific module

### ❓ Help
- `/angel-help` → Full command list
- `/angel-health` → Check if bot working

---

## 🔧 Environment Setup

**File:** `.env`

```
DISCORD_TOKEN=your_bot_token_here
BACKEND_URL=http://localhost:3000
GUILD_ID=your_server_id
```

---

## 📚 Full Documentation

See `SETUP.md` for:
- Step-by-step setup
- Creating Discord bot
- Troubleshooting
- Production deployment
- Custom commands

---

## 🐛 Quick Debug

**Bot not responding?**
```bash
# Check backend is running
curl http://localhost:3000/health

# Restart bot
npm start

# Check logs
npm run dev
```

**Bot offline?**
- Verify Discord token in `.env`
- Check backend URL
- Restart bot

**Commands not showing?**
- Wait 30 seconds
- Reload Discord
- Restart bot

---

## 💡 Pro Tips

✅ Commands fetch data **on-demand** - always fresh data
✅ Mobile-friendly - use on your phone
✅ Safe to use while gaming - just check Discord
✅ No permissions needed beyond bot token

🎮 **Gaming + Monitoring:**
- Put Discord in second monitor/window
- Run `/angel-status` every minute
- See income rates in real-time
- No interruption to Bitburner

📱 **Remote Monitoring:**
- Monitor from work/school
- Check health periodically
- Can pause/resume if needed
- See everything on phone

---

## 📞 Support

Issues? Check:
1. `.env` file is configured
2. Backend is running: `npm run backend:start`
3. Discord token is valid
4. Check bot logs: `npm run dev`

---

**Ready to go!** 🚀 Use `/angel-help` in Discord to see all commands.
