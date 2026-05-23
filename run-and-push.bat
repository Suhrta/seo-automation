@echo off
cd /d "%~dp0"
node fetch-data.mjs
git add reports/
git commit -m "chore: weekly Search Console report %date:~0,10%"
git push origin main
