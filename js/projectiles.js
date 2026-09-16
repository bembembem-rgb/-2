// --- КЛАССЫ СНАРЯДОВ ---
class PlayerVFXProjectile {
    constructor(x, y, angle, speed, weaponType, dmg = 1) { 
        // Уровни забега умножают здесь, а не в каждой ветке выстрела:
        // пистолет, дробовик, альт-залп и пистолет P2 идут через этот конструктор
        this.dmg = dmg * levelDmgMult() * artDamageMult();
        this.x = x; this.y = y; this.angle = angle;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.img = (weaponType === 2) ? vfxOrange : vfxBlue;
        this.piercing = (weaponType === 3); 
        this.isExplosive = false; 
        this.comboBonus = (weaponType === 3) ? 2 : 1;
        this.life = ((weaponType === 2) ? 800 : 2000) * levelRangeMult();
        this.tideBurst = false;
        this.hitEnemies = new Set();
        this.animFrame = 0; this.maxFrames = 16;
        this.frameTimer = 0; this.frameInterval = 50;
    }
    update(dt) {
        // Отлив: на середине жизни диск разворачивается к стрелку и летит
        // назад. hitEnemies чистится один раз — обратный проход обязан
        // засчитаться, иначе «бьёт дважды» было бы неправдой.
        if (this.surge) {
            const t = 1 - this.life / this.surgeLife;
            this.width = this.height = SURGE_W0 + (SURGE_W1 - SURGE_W0) * t;
        }
        if (this.boomerang && !this.returning && this.life <= this.boomerLife / 2) {
            this.returning = true;
            this.hitEnemies = new Set();
            const t = player || { x: this.x, y: this.y };
            this.angle = Math.atan2(t.y - this.y, t.x - this.x);
            const sp = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(this.angle) * sp; this.vy = Math.sin(this.angle) * sp;
        }
        this.x += this.vx; this.y += this.vy; this.life -= dt;
        this.frameTimer += dt;
        if(this.frameTimer >= this.frameInterval) { this.animFrame = (this.animFrame + 1) % this.maxFrames; this.frameTimer = 0; }
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        if (this.img.complete && this.img.width > 0) {
            let fw = Math.floor(this.img.width / 16), fh = Math.floor(this.img.height / 16);
            ctx.drawImage(this.img, this.animFrame * fw, 0, fw, fh, -24, -12, 48, 24);
        } else { ctx.fillStyle = '#00ffff'; ctx.fillRect(-10, -4, 20, 8); }
        ctx.restore();
    }
}

class HelicopterRocket {
    constructor(x, y, angle) {
        this.x = x; this.y = y; this.angle = angle;
        this.speed = 10; this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
        this.life = 1500; this.isRocket = true; 
    }
    update(dt) { this.x += this.vx; this.y += this.vy; this.life -= dt; if (Math.random() < 0.6) spawnParticles(this.x, this.y, '#555555', 1); }
    draw(ctx) { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.fillStyle = '#ff4400'; ctx.fillRect(-15, -6, 30, 12); ctx.fillStyle = '#ffffff'; ctx.fillRect(10, -4, 10, 8); ctx.restore(); }
}

class EnemyProjectile {
    constructor(x, y, vx, vy, color = '#ff003c', radius = 4) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.speed = 8; this.radius = radius; this.color = color;
        this.animFrame = 0; this.frameTimer = 0; this.frameInterval = 50;
    }
    update(dt) { 
        this.x += this.vx * this.speed; this.y += this.vy * this.speed; 
        if(dt) { this.frameTimer += dt; if(this.frameTimer >= this.frameInterval) { this.animFrame = (this.animFrame + 1) % 16; this.frameTimer = 0; } }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); let angle = Math.atan2(this.vy, this.vx); ctx.rotate(angle);
        if (vfxPurple.complete && vfxPurple.width > 0) { let fw = Math.floor(vfxPurple.width / 16), fh = Math.floor(vfxPurple.height / 16); ctx.drawImage(vfxPurple, this.animFrame * fw, 0, fw, fh, -16, -8, 32, 16); } 
        else { ctx.shadowBlur = 10; ctx.shadowColor = this.color; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
}
