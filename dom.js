const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hpContainer = document.getElementById('hp-container');
const dashStatus = document.getElementById('dash-status');
const p2UiContainer = document.getElementById('p2-ui-container');
const p2DashStatus = document.getElementById('p2-dash-status');
const p2TargetStatus = document.getElementById('p2-target-status');
const p2ParryStatus = document.getElementById('p2-parry-status');
const p2PulseStatus = document.getElementById('p2-pulse-status');
const p2RepairStatus = document.getElementById('p2-repair-status');
const p1RoleLabel = document.getElementById('p1-role');
const altStatus = document.getElementById('alt-status');
const vehicleHpUI = document.getElementById('vehicle-hp');
const vehicleHpWrap = document.getElementById('vehicle-hp-wrap');
const vehicleHpBar = document.getElementById('vehicle-hp-bar');
const rankDisplay = document.getElementById('rank');
const scoreDisplay = document.getElementById('score');
const zoneDisplay = document.getElementById('zone-display');
const coresDisplay = document.getElementById('cores-display');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
}
