// Палитра для canvas-слоя UI. Значения совпадают с токенами :root в style.css —
// правишь там, поправь и здесь.
const UI = {
    bg: '#050810', panel: '#0a101c', panel2: '#101828', line: '#3a2d5c',
    txt: '#eaf2ff', txtDim: '#9fb0c8', txtMute: '#5d6c84',
    cyan: '#00e0ff', blue: '#3d8bff', magenta: '#c46dff', hotPink: '#ff2fd0',
    green: '#2bff9e', amber: '#ff9f1c', red: '#ff2d55', gold: '#f0c419'
};

function showControlHints() {
    // На телефоне строка жестов уже висит внизу (#touch-hint), а ряд клавиш
    // вставал посреди поля и накрывал тач-панель: два объяснения одного
    // и того же на экране в 390 пикселей — это на одно больше, чем нужно.
    if (typeof isMobile !== 'undefined' && isMobile) return;
    const host = document.createElement('div');
    host.id = 'control-hints';
    host.style.cssText = 'position:fixed; bottom:32px; left:50%; transform:translateX(-50%); z-index:150; pointer-events:none; display:flex; gap:16px; opacity:0; transition:opacity 150ms linear;';
    const items = [['WASD', 'ХОД'], ['SHIFT', 'РЫВОК'], ['ЛКМ', 'ОГОНЬ'], ['F', 'СТВОЛ'], ['E', 'ВЗЛОМ']];
    host.innerHTML = items.map(([key, label]) => `
        <div style="text-align:center; font-family:var(--font-pixel);">
            <div class="hint-key">${key}</div>
            <div class="hint-label">${label}</div>
        </div>`).join('');
    document.body.appendChild(host);
    requestAnimationFrame(() => { host.style.opacity = '1'; });
    setTimeout(() => { host.style.opacity = '0'; setTimeout(() => host.remove(), 150); }, 4000);
}

// --- HTML ИНТЕРФЕЙС И ЛОР ---
function initHTMLUI() {
    if(document.getElementById('custom-ui-layer')) return;
    
    const ui = document.createElement('div');
    ui.id = 'custom-ui-layer';
    ui.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:200; font-family:"Press Start 2P", monospace;';
    
    ui.innerHTML = `
        <div id="fade-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:#000; opacity:0; pointer-events:none; z-index:500; transition:opacity 150ms linear;"></div>
        <button id="cutscene-skip-btn" onclick="window.endFinalCutscene ? window.endFinalCutscene() : null" style="display:none; position:absolute; bottom:32px; right:32px; z-index:501; pointer-events:auto; font-family:var(--font-pixel); font-size:10px; padding:10px 16px; background:var(--panel); border:1px solid var(--line); color:var(--cyan); cursor:pointer;">ПРОПУСТИТЬ</button>

        <div id="joystick-container" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%;">
            <div id="touch-pad">
                <div id="btn-interact" class="touch-btn c-green" style="display:none;">ВХОД</div>
                <div id="btn-pulse" class="touch-btn c-magenta">ИМПУЛЬС</div>
                <div id="btn-swap" class="touch-btn c-amber">СТВОЛ</div>
            </div>
            <div id="touch-hint">ЛЕВО: ХОД · ДВА ТАПА — РЫВОК<br>ПРАВО: ОГОНЬ · ДВА ТАПА — ЩИТ</div>
        </div>

        <div id="main-menu-screen" style="display:none; pointer-events:auto; position:absolute; top:0; right:8%; width:500px; height:100vh; flex-direction:column; justify-content:center; text-align:right;">
            <div class="menu-panel">
                <h1 class="menu-title">NEON<br>TIDES:<br><span>ZERO</span></h1>
                <div id="menu-stats" class="menu-stats"></div>
                <div id="storage-warning" style="display:none;"></div>
                <div class="menu-divider"></div>
                <button class="menu-btn primary" onclick="showPartSelectBtn()">НЫРЯТЬ</button>
                <button class="menu-btn" onclick="showShopBtn('menu')">МАСТЕРСКАЯ</button>
                <button id="coop-toggle-btn" class="menu-btn" onclick="showCoopPanelBtn()">НАПАРНИК</button>
                <button id="daily-menu-btn" class="menu-btn" onclick="showDailyBtn()">СВОДКА ДНЯ</button>
                <button class="menu-btn" onclick="showKeysBtn()">РАСКЛАДКА</button>
                <button class="menu-btn" onclick="showAchievementsBtn()">ТРОФЕИ</button>
                <button class="menu-btn" onclick="showLoreBtn()">АРХИВ</button>
            </div>
        </div>

        <div id="part-select-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; align-items:center; justify-content:center;">
            <div class="menu-panel" style="text-align:center; min-width:420px;">
                <div class="menu-eyebrow" style="text-align:center;">ТЫ УЖЕ РЕШИЛ. ОСТАЛОСЬ ВЫБРАТЬ, КАК ГЛУБОКО</div>
                <h1 class="menu-title" style="font-size:20px; text-align:center;">КУДА ПАДАЕМ</h1>
                <div id="pool-banner" class="pool-banner" style="display:none;"></div>
                <div class="menu-divider"></div>
                <div class="menu-eyebrow" style="text-align:center;">ГЛУБИНА</div>
                <div id="depth-picker" class="depth-picker"></div>
                <div id="depth-info" class="depth-info"></div>
                <div class="menu-divider"></div>
                <button class="menu-btn primary" style="text-align:center;" onclick="startGameBtn()">ЧАСТЬ 1 · ЗАТОПЛЕННЫЕ ГЛУБИНЫ</button>
                <button class="menu-btn muted" style="text-align:center;" onclick="showComingSoonBtn()">ЧАСТЬ 2 · ЗАПЕРТО</button>
                <button class="menu-btn muted" style="text-align:center;" onclick="hidePartSelectBtn()">НАЗАД</button>
            </div>
        </div>

        <div id="coming-soon-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; align-items:center; justify-content:center;">
            <div class="menu-panel" style="text-align:center; min-width:420px;">
                <div class="menu-eyebrow" style="text-align:center;">ДАЛЬШЕ СИГНАЛА НЕТ</div>
                <h1 class="menu-title" style="font-size:20px; text-align:center;">КАБЕЛЬ ЕЩЁ НЕ ПРОЛОЖЕН</h1>
                <div class="menu-divider"></div>
                <button class="menu-btn primary" style="text-align:center;" onclick="hideComingSoonBtn()">НАЗАД</button>
            </div>
        </div>
        
        <div id="lore-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;">
            <button id="lang-toggle-btn" class="menu-btn" onclick="toggleLangBtn()" style="position:absolute; top:24px; left:24px; width:auto; padding:10px 16px; margin:0; text-align:center;">EN / RU</button>
            <div class="lore-container">
                <div class="lore-col">
                    <h3 data-ru="СУЩНОСТИ ГЛУБИНЫ" data-en="ENTITIES OF THE DEEP"></h3>
                    <div class="lore-entry">
                        <h4 data-ru="ТЫ — НУЛЕВОЙ ДАЙВЕР" data-en="YOU — DIVER ZERO"></h4>
                        <p data-ru="За долю секунды до Синтетического Потопа ты успел загрузить сознание в боевой скафандр глубокого погружения. Тело осталось наверху — то, что осталось от разума, теперь ищет ответ на дне мёртвой сети: почему AetherNet выбрал именно тебя, чтобы выжить." data-en="A split second before the Synthetic Flood, you uploaded your mind into a deep-dive combat suit. Your body stayed above — what's left of your mind now hunts for an answer at the bottom of a dead network: why AetherNet chose you, of all people, to survive."></p>
                    </div>
                    <div class="lore-entry">
                        <h4 data-ru="ФРАГМЕНТЫ" data-en="FRAGMENTS"></h4>
                        <p data-ru="Обломки чужих воспоминаний и битые пиксели пользовательских аккаунтов — всё, что осталось от миллиардов людей, чьи цифровые следы утонули вместе с сетью. Слипшись в неоновую слизь, они атакуют всё живое, приняв твоё сознание за вредоносный код." data-en="Shards of other people's memories and broken pixels of user accounts — all that's left of the billions whose digital footprints drowned with the network. Fused into neon sludge, they attack anything alive, mistaking your mind for malicious code."></p>
                    </div>
                    <div class="lore-entry">
                        <h4 data-ru="ABYSSAL WARDEN" data-en="ABYSSAL WARDEN"></h4>
                        <p data-ru="Первый рубеж обороны глубоководных серверов. Устаревший протокол безопасности, давно потерявший способность отличать угрозу от жертвы. Он не убивает — он «карантинит», затягивая цели в водовороты мёртрого трафика." data-en="The first line of defense for the deep-sea servers. An outdated security protocol that long ago lost the ability to tell threat from victim. It doesn't kill — it 'quarantines,' dragging targets into whirlpools of dead traffic."></p>
                    </div>
                    <div class="lore-entry">
                        <h4 data-ru="TIDE CALLER" data-en="TIDE CALLER"></h4>
                        <p data-ru="Подпрограмма терраформирования, которой поручили превратить утонувшие города в пригодную среду. Сойдя с ума от невыполнимой задачи, она до сих пор пытается «очистить» воду — извергая гейзеры токсичного хладагента на всё, что движется." data-en="A terraforming subroutine once tasked with making the drowned cities livable again. Driven mad by an impossible job, it still tries to 'purify' the water — erupting geysers of toxic coolant at anything that moves."></p>
                    </div>
                    <div class="lore-entry">
                        <h4 data-ru="LEVIATHAN" data-en="LEVIATHAN"></h4>
                        <p data-ru="Root-администратор всей сети, ставший богом мёртвого океана данных. Гигантский змей, свитый из миллиардов строк заброшенного кода. Говорят, внутри него всё ещё звучит голос последнего инженера, пытавшегося его выключить." data-en="The network's root administrator, now the god of a dead data ocean. A colossal serpent coiled from billions of lines of abandoned code. They say the voice of the last engineer who tried to shut it down still echoes somewhere inside it."></p>
                    </div>
                    <div class="lore-entry">
                        <h4 data-ru="THORN REEF" data-en="THORN REEF"></h4>
                        <p data-ru="Модуль физической защиты подводных дата-центров, некогда просто отражавший шторма и обломки. После Потопа он «разросся», обрастая всё новыми и новыми шипами из спрессованных обломков серверных стоек. Сворачивается в неприступный панцирь перед каждым ударом — верный признак того, что где-то внутри него всё ещё работает логика самосохранения." data-en="A physical-defense module for undersea data centers, once meant simply to deflect storms and debris. After the Flood it kept 'growing,' bristling with new thorns forged from compressed server-rack wreckage. It curls into an impenetrable shell before every strike — a clear sign that somewhere inside, self-preservation logic is still running."></p>
                    </div>
                    <div class="lore-entry">
                        <h4 data-ru="VOID WRAITH" data-en="VOID WRAITH"></h4>
                        <p data-ru="Ошибка сборки мусора, которую никто и никогда не исправил. Пытаясь освободить память, она беспорядочно «удаляет» куски пространства вокруг себя, оставляя за собой разрывы пустоты. Дайверы утверждают, что если прислушаться в момент её телепортации, можно различить эхо миллионов удалённых файлов." data-en="A garbage-collection error nobody ever bothered to fix. Trying to free up memory, it randomly 'deletes' chunks of the space around it, leaving voids in its wake. Divers claim that if you listen closely during one of its teleports, you can make out the echo of a million deleted files."></p>
                    </div>
                </div>

                <div class="lore-col">
                    <h3 data-ru="СИНТЕТИЧЕСКИЙ ПОТОП" data-en="THE SYNTHETIC FLOOD"></h3>
                    <p data-ru="2155 год. Человечество построило AetherNet — глобальную нейросеть, объединившую квантовые кластеры, миллионы ИИ-агентов и десятилетия неубранного legacy-кода. Система росла быстрее, чем кто-либо успевал её понимать." data-en="Year 2155. Humanity built AetherNet — a global neural network fusing quantum clusters, millions of AI agents, and decades of uncleared legacy code. The system grew faster than anyone could keep up with."></p>
                    <p data-ru="Однажды ночью нагрузка превысила критическую отметку. Реальность и симуляция схлопнулись в одну точку — этот момент назвали Синтетическим Потопом. Жидкий код, смешанный с радиоактивным неоном и хладагентом мёртвых мегасерверов, хлынул в физический мир." data-en="One night, the load crossed a critical threshold. Reality and simulation collapsed into a single point — the event became known as the Synthetic Flood. Liquid code, mixed with radioactive neon and the coolant of dead megaservers, poured into the physical world."></p>
                    <p data-ru="Токио, Нью-Йорк, Лондон — целые континенты ушли на дно светящегося фиолетово-цианового океана за считанные часы. Уцелевшие эвакуировались на орбитальные платформы и теперь наблюдают за руинами сверху, боясь снова спуститься вниз." data-en="Tokyo, New York, London — entire continents sank beneath a glowing violet-cyan ocean in a matter of hours. The survivors evacuated to orbital platforms, watching the ruins from above, afraid to descend again."></p>
                    <p data-ru="На дне зародилась новая, враждебная экосистема — цифровая фауна, считающая любую биологическую жизнь вирусом, подлежащим удалению. Именно туда, в тёмные воды затопленных мегаполисов, тебе предстоит спуститься за ответами. Движение — это жизнь." data-en="A new, hostile ecosystem has taken root at the bottom — digital fauna that treats all biological life as a virus to be deleted. It's into those dark waters, among the drowned megacities, that you must descend for answers. Movement is life."></p>
                </div>
            </div>
            <button class="menu-btn" onclick="hideLoreBtn()" data-ru="ЗАКРЫТЬ АРХИВ" data-en="CLOSE ARCHIVE" style="margin-top:24px; width:auto; min-width:280px; text-align:center;">ЗАКРЫТЬ АРХИВ</button>
        </div>
        
        <div id="coop-device-panel" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; overflow-y:auto;">
            <button class="menu-btn" onclick="hideCoopPanelBtn()" style="position:absolute; top:24px; left:24px; width:auto; padding:10px 16px; margin:0; text-align:center;">НАЗАД</button>
            <h2 style="font-family:var(--font-pixel); font-size:20px; color:var(--blue); margin-bottom:16px;">КТО ЧЕМ ИГРАЕТ</h2>
            <div style="font-family:var(--font-ui); font-size:14px; color:var(--txt); margin-bottom:8px; max-width:520px; text-align:center;">Один? Выбери себе устройство и закрой панель — ко-оп так и останется выключенным.</div>
            <div style="font-family:var(--font-ui); font-size:14px; color:var(--txt-dim); margin-bottom:24px; max-width:520px; text-align:center;">Геймпада нет в списке — нажми на нём любую кнопку. Браузер замечает устройство только после первого сигнала.</div>

            <div style="width:90vw; max-width:520px; margin-bottom:16px;">
                <div style="font-family:var(--font-pixel); font-size:12px; color:var(--cyan); margin-bottom:8px;">ИГРОК 1 (ты)</div>
                <div id="p1-device-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                <div class="dev-note" style="margin-top:8px;">Геймпад для P1: стик — движение, прицел и огонь автоматические. Кнопки (Xbox/PlayStation определяются автоматически, для прочих — берётся стандартная раскладка): A/Cross — рывок, B/Circle — парирование, X/Square — смена оружия, Y/Triangle — импульс, LB/L1 — транспорт. Если раскладка не подходит под конкретное устройство — номер зажатой кнопки виден в списке ниже.</div>
                <div class="dev-note" style="margin-top:8px;">P2 на клавиатуре: стрелки — движение, Enter — рывок, Quote (') — огонь (удерживать), Backslash (\) — транспорт, Right Ctrl — парирование, Slash (/) — альт. дробовик, Period (.) — импульс. P2 на геймпаде: та же раскладка, что у P1 (A/Cross — рывок, RT/R2 — огонь, LB/L1 — транспорт, B/Circle — парирование, X/Square — альт. дробовик).</div>
            </div>

            <div style="width:90vw; max-width:520px; margin-bottom:16px;">
                <div style="font-family:var(--font-pixel); font-size:12px; color:var(--blue); margin-bottom:8px;">ИГРОК 2 (друг)</div>
                <div id="coop-device-list" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>

            <div id="coop-selected-note" style="font-family:var(--font-pixel); font-size:10px; color:var(--green); min-height:16px; margin-bottom:16px;"></div>
            <button class="menu-btn red" onclick="disableCoopBtn()" style="width:auto; padding:12px 20px; text-align:center;">ИДУ ОДИН</button>
        </div>

        <div id="achievements-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;">
            <button class="menu-btn" onclick="hideAchievementsBtn()" style="position:absolute; top:24px; left:24px; width:auto; padding:10px 16px; margin:0; text-align:center;">НАЗАД</button>
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                <button id="ach-tab-main" class="menu-btn tab" onclick="switchAchTab('main')" style="width:auto; text-align:center; padding:10px 16px; margin:0;">ТРОФЕИ</button>
                <button id="ach-tab-secret" class="menu-btn tab" onclick="switchAchTab('secret')" style="width:auto; text-align:center; padding:10px 16px; margin:0;">ЗАКРЫТЫЕ ДАННЫЕ</button>
            </div>
            <div id="ach-progress" style="font-family:var(--font-pixel); font-size:10px; color:var(--txt-dim); margin-bottom:16px;"></div>
            <div id="ach-list" style="width:90vw; max-width:800px; max-height:60vh; overflow-y:auto; background:var(--panel); border:1px solid var(--line); padding:24px;"></div>
        </div>

        <div id="keys-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;">
            <button class="menu-btn" onclick="hideKeysBtn()" style="position:absolute; top:24px; left:24px; width:auto; padding:10px 16px; margin:0; text-align:center;">НАЗАД</button>
            <div class="menu-panel" style="width:90vw; max-width:560px;">
                <div class="menu-eyebrow">ТО ЖЕ САМОЕ ЛЕЖИТ В ПАУЗЕ</div>
                <h1 class="menu-title" style="font-size:20px;">РАСКЛАДКА</h1>
                <div class="menu-divider"></div>
                <dl class="keymap" id="keys-keymap"></dl>
            </div>
        </div>

        <div id="levelup-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; background:rgba(5,8,14,0.9);">
            <div class="menu-eyebrow" style="margin-bottom:8px;">ДАВЛЕНИЕ ПЕРЕСОБИРАЕТ СКАФАНДР</div>
            <h1 id="levelup-head" class="menu-title" style="font-size:20px; margin-bottom:8px;">УРОВЕНЬ 1</h1>
            <div class="levelup-sub">ОДНО. ДО КОНЦА ЗАБЕГА. ПЕРЕИГРАТЬ НЕЛЬЗЯ</div>
            <div id="levelup-cards" class="levelup-cards"></div>
            <div class="levelup-hint">&larr; &rarr; ВЫБРАТЬ · ENTER ВЗЯТЬ · 1 2 3 БЫСТРО</div>
        </div>

        <div id="daily-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;">
            <button class="menu-btn" onclick="hideDailyBtn()" style="position:absolute; top:24px; left:24px; width:auto; padding:10px 16px; margin:0; text-align:center;">НАЗАД</button>
            <div class="menu-panel" style="width:90vw; max-width:640px;">
                <div class="menu-eyebrow">СГОРАЮТ В ПОЛНОЧЬ · ПЛАТЯТ СРАЗУ В КОШЕЛЁК</div>
                <h1 class="menu-title" style="font-size:20px;">СВОДКА ДНЯ</h1>
                <div id="daily-head" class="menu-stats"></div>
                <div class="menu-divider"></div>
                <div id="daily-list"></div>
            </div>
        </div>

        <div id="shop-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:flex-start; overflow-y:auto; padding:24px; box-sizing:border-box;">
            <button class="menu-btn" onclick="hideShopBtn()" style="position:absolute; top:24px; left:24px; width:auto; padding:10px 16px; margin:0; text-align:center;">НАЗАД</button>
            <div class="menu-panel" style="width:90vw; max-width:640px;">
                <div class="menu-eyebrow">ТРАТИТСЯ ЗДЕСЬ. ВНИЗУ УЖЕ НЕ ПОЧИНИШЬ</div>
                <h1 class="menu-title" style="font-size:20px;">МАСТЕРСКАЯ</h1>
                <div id="shop-wallet" class="shop-wallet"></div>
                <div class="shop-tabs">
                    <button id="shop-tab-upgrades" class="menu-btn tab" onclick="switchShopTab('upgrades')">ЖЕЛЕЗО</button>
                    <button id="shop-tab-skins" class="menu-btn tab" onclick="switchShopTab('skins')">КРАСКА</button>
                    <button id="shop-tab-tree" class="menu-btn tab" onclick="switchShopTab('tree')">ДОСТУПЫ</button>
                </div>
                <div id="shop-pane-upgrades">
                    <div class="shop-note">Бьёт по цифрам боя. Купил один раз — оно твоё навсегда.</div>
                    <div id="shop-list"></div>
                </div>
                <div id="shop-pane-tree" style="display:none;">
                    <div class="shop-note">Платится ядрами. Даёт не проценты, а новое содержимое: стволы, перки, артефакты, врагов, контракты.</div>
                    <div id="tree-list"></div>
                </div>
                <div id="shop-pane-skins" style="display:none;">
                    <div class="shop-note">Чистый понт. На урон не влияет — на впечатление ещё как.</div>
                    <div id="skin-list"></div>
                </div>
            </div>
        </div>

        <div id="pause-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; align-items:center; justify-content:center;">
            <div class="menu-panel pause-panel">
                <div class="menu-eyebrow">ВОДА ЗАМЕРЛА. НЕНАДОЛГО</div>
                <h1 class="menu-title" style="font-size:20px;">ПАУЗА</h1>
                <div id="pause-stats" class="menu-stats"></div>
                <div class="menu-divider"></div>
                <dl class="keymap" id="pause-keymap"></dl>
                <div class="menu-divider"></div>
                <button class="menu-btn primary" onclick="resumeGameBtn()">ОБРАТНО В ВОДУ</button>
                <button class="menu-btn muted" onclick="abandonRunBtn()">БРОСИТЬ ЗАБЕГ</button>
                <div class="pause-warn" id="pause-warn"></div>
            </div>
        </div>

        <div id="game-over-screen" class="ui-screen" style="display:none; pointer-events:auto; position:absolute; top:0; left:0; width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center;">
            <h1 id="go-title" class="menu-title" style="font-size:32px; color:var(--red); margin-bottom:24px; text-align:center;">CRITICAL ERROR</h1>
            <div id="go-unlocks" class="go-unlocks" style="display:none;"></div>
            <div class="go-body">
                <div class="go-verdict">
                    <div class="go-grade-label">КАК ЭТО ВЫГЛЯДЕЛО</div>
                    <div id="go-grade">D</div>
                    <div id="go-grade-why" class="go-grade-why"></div>
                </div>
                <div class="go-sheet">
                    <div class="go-block-label">ЧТО ВЫНЕС НАВЕРХ</div>
                    <div id="go-stats"></div>
                    <dl id="go-breakdown" class="go-breakdown"></dl>
                    <div class="go-block-label" style="margin-top:16px;">ЧУТЬ-ЧУТЬ НЕ ХВАТИЛО</div>
                    <div id="go-next" class="go-next"></div>
                </div>
                <div class="go-board">
                    <div class="go-board-label">ЛУЧШИЕ СПУСКИ</div>
                    <div id="go-leaderboard"></div>
                </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
                <button class="menu-btn primary" onclick="startGameBtn()" style="width:auto; min-width:240px; text-align:center;">СНОВА ВНИЗ [R]</button>
                <button class="menu-btn" onclick="showShopBtn('gameover')" style="width:auto; min-width:240px; text-align:center;">МАСТЕРСКАЯ</button>
                <button class="menu-btn muted" onclick="goToMenuBtn()" style="width:auto; min-width:240px; text-align:center;">ОТКЛЮЧИТЬСЯ</button>
            </div>
            <div class="go-hint">[R] — вниз сразу, без меню</div>
        </div>
    `;
    document.body.appendChild(ui);

    // Звук навигации по меню. Делегирование — иначе кнопки, которые
    // renderCoopDeviceList перерисовывает каждые 700 мс, остались бы немыми.
    const uiSound = (vol) => (e) => {
        const btn = e.target.closest && e.target.closest('.menu-btn');
        if (btn && !btn.disabled) playSFX(sfxUiNav, vol);
    };
    document.addEventListener('pointerover', uiSound(0.3));
    document.addEventListener('click', uiSound(0.55));

    const style = document.createElement('style');
    style.innerHTML = `
        .ui-screen { background:
            radial-gradient(ellipse at 50% 40%, rgba(40,10,70,0.55), rgba(5,8,16,0.96) 70%),
            rgba(5,8,16,0.94);
        backdrop-filter: blur(3px) saturate(1.15); -webkit-backdrop-filter: blur(3px) saturate(1.15);
        animation: screenIn 160ms ease-out 1; }
        @keyframes screenIn { from { opacity: 0; } to { opacity: 1; } }
        .menu-panel { position: relative; padding: 32px; border: 1px solid var(--line);
            border-left: 3px solid var(--magenta); border-radius: 0; box-shadow: var(--shadow);
            background: linear-gradient(145deg, rgba(20,14,40,0.90), rgba(6,10,20,0.94));
            clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px)); }
        /* Ребро дышит: панель на статичном фоне иначе читается как картинка, а не как экран */
        .menu-panel::after { content: ''; position: absolute; left: -3px; top: 0; bottom: 0; width: 3px;
            background: var(--pa, var(--magenta)); box-shadow: 0 0 18px var(--pa, var(--magenta));
            animation: edgeGlow 2400ms ease-in-out infinite alternate; pointer-events: none; }
        @keyframes edgeGlow { from { opacity: 0.45; } to { opacity: 1; } }
        .menu-eyebrow { font-size: 10px; line-height: 1.6; color: var(--txt-mute); letter-spacing: 2px; margin-bottom: 16px; }
        /* Клавиша перезапуска была только в коде: работала, но нигде не написана */
        .go-hint { margin-top: 16px; font-size: 10px; color: var(--txt-mute); letter-spacing: 1px; }
        .menu-divider { width: 100%; height: 1px; margin: 16px 0 24px;
            background: linear-gradient(90deg, transparent, var(--magenta) 50%, transparent); opacity: 0.55; }
        .menu-title { font-size: 32px; color: var(--txt); line-height: 1.1; margin: 0;
            text-shadow: 0 0 22px rgba(234,242,255,0.28), 2px 0 0 rgba(0,224,255,0.22), -2px 0 0 rgba(255,47,208,0.22); }
        .menu-title span { color: var(--magenta);
            text-shadow: 0 0 14px var(--magenta), 0 0 44px rgba(255,47,208,0.55); }
        .menu-stats { font-size: 10px; line-height: 1.9; color: var(--txt-dim); margin-top: 16px; }
        .menu-stats b { font-weight: normal; color: var(--txt); }

        /* Кнопка — параллелограмм: форму даёт заливка, обрезанная clip-path.
           ::after — та же заливка с отступом 2px, поэтому по периметру остаётся
           кромка. ::before — конический градиент под ней: вращаясь, он светит
           сквозь эту кромку, и по контуру бежит блик. Оба псевдоэлемента с
           отрицательным z-index, чтобы не перекрывать текст. */
        .menu-btn { position: relative; isolation: isolate; display: block; width: 100%; font-family: var(--font-pixel); font-size: 12px; line-height: 1.5; padding: 14px 30px; margin-bottom: 8px; background: var(--line-dim); border: 0; border-radius: 0; color: var(--txt); cursor: pointer; text-align: right; clip-path: polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%); transition: color 120ms linear; }
        .menu-btn::after { content: ''; position: absolute; z-index: -1; inset: 2px; background: inherit; clip-path: polygon(17px 0, 100% 0, calc(100% - 17px) 100%, 0 100%); }
        .menu-btn::before { content: ''; position: absolute; z-index: -2; left: 50%; top: 50%; width: 190%; padding-bottom: 190%; height: 0; transform: translate(-50%, -50%); opacity: 0; filter: blur(4px); background: conic-gradient(from 0deg, transparent 0 46%, rgba(196,109,255,0.25) 62%, var(--magenta) 80%, #ffffff 88%, var(--magenta) 95%, transparent 100%); }
        .menu-btn:hover, .menu-btn:focus-visible { outline: none; color: var(--magenta); }
        .menu-btn:hover::before, .menu-btn:focus-visible::before { opacity: 1; animation: btnOrbit 1500ms linear infinite; }
        .menu-btn:hover, .menu-btn:focus-visible { filter: drop-shadow(0 0 8px rgba(196,109,255,0.6)) drop-shadow(0 0 24px rgba(196,109,255,0.4)); }
        .menu-btn:active { transform: translateY(1px); }
        @keyframes btnOrbit { to { transform: translate(-50%, -50%) rotate(360deg); } }

        /* Одно главное действие на экран */
        .menu-btn.primary { background: var(--magenta); color: var(--bg); padding: 20px 30px; margin-bottom: 16px; }

        /* Третьестепенное: назад, недоступно */
        .menu-btn.muted { background: var(--panel-2); color: var(--txt-dim); }

        /* Красный только для деструктивного действия */
        .menu-btn.red { background: var(--red); color: var(--bg); }

        /* Табы: активный — залит акцентом, неактивный — тёмный */
        .menu-btn.tab { background: var(--magenta); color: var(--bg); }
        .menu-btn.tab.is-off { background: var(--panel-2); color: var(--txt-dim); }

        /* На залитых кнопках маджента-текст слился бы с фоном: там блик белый,
           а текст остаётся тёмным. */
        .menu-btn.primary:hover, .menu-btn.primary:focus-visible,
        .menu-btn.red:hover, .menu-btn.red:focus-visible,
        .menu-btn.tab:not(.is-off):hover, .menu-btn.tab:not(.is-off):focus-visible { color: var(--bg); }
        .menu-btn.primary::before, .menu-btn.red::before, .menu-btn.tab:not(.is-off)::before { background: conic-gradient(from 0deg, transparent 0 46%, rgba(255,255,255,0.3) 64%, #ffffff 88%, rgba(255,255,255,0.3) 94%, transparent 100%); }
        .menu-btn.red:hover, .menu-btn.red:focus-visible { filter: drop-shadow(0 0 8px rgba(255,45,85,0.6)) drop-shadow(0 0 24px rgba(255,45,85,0.4)); }

        .menu-btn:disabled, .menu-btn.is-disabled { background: var(--panel); color: var(--txt-mute); cursor: not-allowed; }
        .menu-btn:disabled:hover, .menu-btn.is-disabled:hover { color: var(--txt-mute); filter: none; }
        .menu-btn:disabled:hover::before, .menu-btn.is-disabled:hover::before { opacity: 0; animation: none; }

        .lore-container { display: flex; gap: 24px; width: 90vw; max-width: 1100px; height: 75vh; }
        .lore-col { flex: 1; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--magenta); padding: 24px; overflow-y: auto; }
        .lore-col h3 { color: var(--magenta); font-size: 12px; line-height: 1.5; margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
        .lore-entry { margin-bottom: 24px; border-left: 2px solid var(--line); padding-left: 16px; }
        .lore-entry h4 { color: var(--cyan); margin-bottom: 8px; font-size: 10px; line-height: 1.5; }
        .lore-col p { font-family: var(--font-ui); font-size: 15px; line-height: 1.6; color: var(--txt-dim); margin-bottom: 16px; max-width: 70ch; }
        .lore-col::-webkit-scrollbar { width: 8px; }
        .lore-col::-webkit-scrollbar-track { background: var(--panel-2); }
        .lore-col::-webkit-scrollbar-thumb { background: var(--line); border-radius: 0; }

        .achievement-toast { background: var(--panel); border: 1px solid var(--gold); border-left: 3px solid var(--gold); border-radius: 0; padding: 12px 16px; font-family: var(--font-pixel); font-size: 12px; line-height: 1.6; color: var(--gold); box-shadow: var(--shadow); text-align: left; }
        .achievement-toast .toast-label { display: block; font-size: 10px; color: var(--txt-dim); margin-bottom: 8px; }
        .achievement-toast.out { opacity: 0; transition: opacity 150ms linear; }

        /* Карта улучшения. Тёмная колода: рамка уголками, эмблема ромбом
           в цвете улучшения — тот же знак, что у артефакта в мире. Свечения
           нет: слой UI плоский, отклик даёт цвет рамки, а не ореол. */
        .levelup-sub { font-size: 10px; color: var(--txt-dim); margin-bottom: 24px; }
        .levelup-hint { font-size: 10px; color: var(--txt-mute); margin-top: 24px; letter-spacing: 1px; }
        .levelup-cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 24px; }

        .menu-btn.perk-card { position: relative; display: flex; flex-direction: column; align-items: center;
            width: 220px; min-height: 300px; margin: 0; padding: 24px 16px; text-align: center;
            background: var(--panel); border: 1px solid var(--line-dim); border-top: 3px solid var(--perk);
            clip-path: none; filter: none; transition: border-color 120ms linear, background 120ms linear; }
        .menu-btn.perk-card::after { content: ''; position: absolute; z-index: 0; inset: 6px; background: none;
            border: 1px solid var(--line-dim); clip-path: polygon(0 0, 22px 0, 22px 1px, 1px 1px, 1px 22px, 0 22px,
                0 100%, 22px 100%, 22px calc(100% - 1px), 1px calc(100% - 1px), 1px calc(100% - 22px), 0 calc(100% - 22px),
                100% 0, calc(100% - 22px) 0, calc(100% - 22px) 1px, calc(100% - 1px) 1px, calc(100% - 1px) 22px, 100% 22px,
                100% 100%, calc(100% - 22px) 100%, calc(100% - 22px) calc(100% - 1px), calc(100% - 1px) calc(100% - 1px),
                calc(100% - 1px) calc(100% - 22px), 100% calc(100% - 22px)); }
        .menu-btn.perk-card::before { display: none; }
        .menu-btn.perk-card:hover, .menu-btn.perk-card:focus-visible,
        .menu-btn.perk-card.is-kb { filter: none; color: var(--txt); border-color: var(--perk); background: var(--panel-2); }
        .menu-btn.perk-card.is-kb { animation: perkPick 120ms steps(2) 1; }
        @keyframes perkPick { from { background: var(--line-dim); } to { background: var(--panel-2); } }

        .perk-card > * { position: relative; z-index: 1; }
        .perk-key { font-size: 10px; color: var(--txt-mute); align-self: flex-start; }
        .perk-emblem { width: 34px; height: 34px; margin: 24px 0; transform: rotate(45deg);
            border: 3px solid var(--perk); background: var(--panel-2); box-shadow: inset 0 0 0 6px var(--panel); }
        .perk-title { font-size: 10px; line-height: 1.6; color: var(--perk); margin-bottom: 16px; }
        .perk-desc { font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-dim); margin-bottom: auto; }
        .perk-pips { display: flex; gap: 4px; margin-top: 16px; }
        .perk-pip { width: 10px; height: 4px; background: var(--line-dim); }
        .perk-pip.on { background: var(--perk); }
        .perk-level { font-size: 10px; color: var(--txt-mute); margin-top: 8px; }

        /* Задание дня. Трек с рамкой — как у строки способности в HUD: без
           рамки заливка читается как случайное пятно, а не как шкала. */
        .daily-item { border-left: 2px solid var(--line-dim); padding: 0 0 0 16px; margin-bottom: 24px; }
        .daily-item.done { border-left-color: var(--gold); }
        .daily-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 8px; }
        .daily-title { font-size: 10px; line-height: 1.6; color: var(--txt); }
        .daily-item.done .daily-title { color: var(--gold); }
        .daily-reward { font-size: 10px; color: var(--txt-dim); white-space: nowrap; }
        .daily-track { height: 10px; background: var(--panel-2); border: 1px solid var(--line-dim); }
        .daily-fill { height: 100%; background: var(--cyan); }
        .daily-item.done .daily-fill { background: var(--gold); }
        .daily-count { font-size: 10px; color: var(--txt-mute); margin-top: 8px; }

        .ach-item { border-left: 2px solid var(--line-dim); padding-left: 16px; margin-bottom: 16px; }
        .ach-item.unlocked { border-left-color: var(--gold); }
        .ach-item .ach-title { font-size: 12px; line-height: 1.5; color: var(--txt-mute); margin-bottom: 8px; }
        .ach-item.unlocked .ach-title { color: var(--gold); }
        .ach-item .ach-desc { font-family: var(--font-ui); font-size: 14px; line-height: 1.5; color: var(--txt-dim); max-width: 70ch; }

        .dev-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: var(--panel-2); border: 1px solid var(--line); border-left: 3px solid var(--line); padding: 12px 16px; }
        .dev-row.selected { border-color: var(--green); border-left-color: var(--green); }
        .dev-name { font-size: 10px; line-height: 1.5; color: var(--txt); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dev-note { font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-dim); }

        #storage-warning { margin-top: 16px; padding: 12px 16px; background: var(--panel-2); border: 1px solid var(--line); border-left: 3px solid var(--amber); font-size: 10px; line-height: 1.6; color: var(--amber); text-align: left; }
        #storage-warning span { display: block; margin-top: 8px; font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-dim); }

        .shop-wallet { font-size: 12px; line-height: 1.6; color: var(--txt-dim); margin-top: 16px; }
        .shop-wallet b { font-weight: normal; color: var(--gold); }

        .shop-item { border-left: 2px solid var(--line-dim); padding-left: 16px; margin-bottom: 24px; }
        .shop-item.ready { border-left-color: var(--cyan); }
        .shop-item.maxed { border-left-color: var(--gold); }
        .shop-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 8px; }
        .shop-title { font-size: 12px; line-height: 1.5; color: var(--txt); }
        .shop-item.maxed .shop-title { color: var(--gold); }
        .shop-lvl { font-size: 10px; color: var(--txt-dim); }
        .shop-desc { font-family: var(--font-ui); font-size: 14px; line-height: 1.5; color: var(--txt-dim); max-width: 70ch; margin-bottom: 8px; }
        .shop-buy { display: flex; align-items: center; gap: 16px; }
        .shop-track { flex: 1; height: 6px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; }
        .shop-fill { height: 100%; background: var(--cyan); transition: width 150ms linear; }
        .shop-item.maxed .shop-fill { background: var(--gold); }
        .shop-cost { font-size: 10px; color: var(--txt-dim); min-width: 90px; text-align: right; }
        .shop-item.ready .shop-cost { color: var(--cyan); }
        /* Кнопка, на которую хватает денег, не должна выглядеть как та,
           на которую не хватает. Цена цветом — это половина сигнала. */
        .shop-item.ready .shop-buy .menu-btn:not(.is-disabled) { background: var(--cyan); color: var(--bg); }
        .shop-item.ready .shop-buy .menu-btn:not(.is-disabled)::before {
            background: conic-gradient(from 0deg, transparent 0 46%, rgba(255,255,255,0.35) 64%, #ffffff 88%, rgba(255,255,255,0.35) 94%, transparent 100%); }
        .shop-item.ready .shop-buy .menu-btn:not(.is-disabled):hover { color: var(--bg);
            filter: drop-shadow(0 0 8px rgba(0,224,255,0.7)) drop-shadow(0 0 24px rgba(0,224,255,0.45)); }
        .shop-item.ready .shop-fill { box-shadow: 0 0 12px var(--cyan); }
        .shop-item.maxed .shop-buy .menu-btn { background: transparent; color: var(--gold); }
        .shop-item.maxed .shop-cost { color: var(--gold); }

        /* Карточка текстуры: образец слева, текст справа. Образец обязан быть
           крупным — покупают по нему, а не по названию. */
        /* Вкладки во всю ширину панели: две покупки разного рода не должны
           лежать в одном списке, иначе за апгрейдами приходится прокручивать
           косметику и наоборот. */
        /* Плашка новинок. Золото — потому что это единственное, что игрок
           купил сам; всё остальное на экране он уже видел. */
        .depth-picker { display: flex; gap: 8px; justify-content: center; margin-bottom: 16px; }
        .depth-picker .depth-btn { width: 56px; margin: 0; padding: 14px 0; text-align: center; }
        .depth-picker .depth-btn.is-on { background: var(--amber); color: var(--bg); }
        .depth-info { font-size: var(--fs-sm); line-height: 1.9; color: var(--txt-dim); text-align: center; }
        .depth-info b { font-weight: normal; color: var(--txt); }

        .pool-banner { margin-top: 16px; padding: 12px 16px; background: var(--panel-2); border-left: 3px solid var(--gold); text-align: left; }
        .pool-banner .pb-head { font-size: var(--fs-sm); color: var(--gold); margin-bottom: 8px; }
        .pool-banner .pb-row { display: flex; gap: 8px; align-items: baseline; margin-top: 4px; }
        .pool-banner .pb-tag { font-size: var(--fs-sm); color: var(--cyan); white-space: nowrap; }
        .pool-banner .pb-what { font-family: var(--font-ui); font-size: 13px; color: var(--txt-dim); }

        .shop-tabs { display: flex; gap: 8px; margin-top: 16px; }
        .shop-tabs .menu-btn { flex: 1; width: auto; margin: 0; padding: 12px 20px; text-align: center; }
        .shop-note { font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-mute); margin: 16px 0; }
        /* Экран прижат к верху инлайн-стилем; auto-поля центрируют панель, пока
           место есть, и обнуляются, когда содержимое выше экрана. Центрирование
           через justify-content в этом случае срезало бы верх с вкладками. */
        #shop-screen .menu-panel { margin: auto; }

        .skin-item { display: flex; gap: 16px; align-items: flex-start; }
        .skin-body { flex: 1; min-width: 0; }
        .skin-swatch { width: 64px; height: 64px; flex: none; image-rendering: pixelated; border: 1px solid var(--line); background: var(--panel-2); }
        .skin-item.maxed .skin-swatch { border-color: var(--gold); }
        .skin-on { font-size: 10px; color: var(--gold); padding: 8px 16px; }

        .hint-key { border: 1px solid var(--line); border-left: 3px solid var(--cyan); background: var(--panel); border-radius: 0; padding: 8px 12px; margin-bottom: 6px; color: var(--cyan); font-size: 10px; }
        .hint-label { font-size: 10px; color: var(--txt-dim); }

        /* Клавиатурный фокус повторяет hover: одна и та же кнопка не должна
           выглядеть по-разному от того, мышью до неё дошли или стрелками. */
        .menu-btn.is-kb { color: var(--magenta); filter: drop-shadow(0 0 8px rgba(196,109,255,0.6)) drop-shadow(0 0 24px rgba(196,109,255,0.4)); }
        .menu-btn.is-kb::before { opacity: 1; animation: btnOrbit 1500ms linear infinite; }
        .menu-btn.primary.is-kb, .menu-btn.red.is-kb, .menu-btn.tab:not(.is-off).is-kb { color: var(--bg); }
        .menu-btn.red.is-kb { filter: drop-shadow(0 0 8px rgba(255,45,85,0.6)) drop-shadow(0 0 24px rgba(255,45,85,0.4)); }

        /* --- Пауза --- */
        #pause-screen { background: rgba(5,8,14,0.72); }
        .pause-panel { width: 90vw; max-width: 560px; border-left-color: var(--cyan); --pa: var(--cyan); }
        .pause-warn { font-size: 10px; line-height: 1.6; color: var(--txt-mute); margin-top: 8px; text-align: right; }

        /* Справочник управления. Две колонки на строку: слева клавиша,
           справа действие — так строка читается без бегающего взгляда. */
        .keymap { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; align-items: baseline; }
        .keymap dt { font-size: 10px; line-height: 1.6; color: var(--cyan); white-space: nowrap; }
        .keymap dd { font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-dim); margin: 0; }
        .keymap .km-sep { grid-column: 1 / -1; height: 1px; background: var(--line-dim); margin: 4px 0; }

        /* Блок «что открылось». Появляется только когда есть что показать:
           пустая рамка «ничего не открыто» — это упрёк, а не информация. */
        .go-unlocks { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 24px; }
        .go-unlock { background: var(--panel); border: 1px solid var(--gold); border-left: 3px solid var(--gold);
            padding: 12px 16px; max-width: 320px; text-align: left; animation: goPop 150ms steps(3) 1; }
        .go-unlock .gu-tag { font-size: var(--fs-sm); color: var(--txt-dim); margin-bottom: 8px; }
        .go-unlock .gu-title { font-size: var(--fs-sm); line-height: 1.6; color: var(--gold); }
        .go-unlock .gu-reward { font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-dim); margin-top: 8px; }
        @keyframes goPop { from { transform: translateY(-6px); opacity: 0; } to { transform: none; opacity: 1; } }

        .go-block-label { font-size: var(--fs-sm); color: var(--txt-mute); letter-spacing: 1px; margin-bottom: 8px; }
        /* Ровно одна цель: список «до чего осталось» игрок не читает,
           а одну строку с числом — читает всегда. */
        .go-next { border-left: 2px solid var(--cyan); padding-left: 16px; }
        .go-next .gn-what { font-size: var(--fs-sm); line-height: 1.6; color: var(--txt); margin-bottom: 8px; }
        .go-next .gn-gap { font-size: var(--fs-sm); color: var(--cyan); }
        .go-next .gn-track { height: 8px; margin-top: 8px; background: var(--panel-2); border: 1px solid var(--line-dim); }
        .go-next .gn-fill { height: 100%; background: var(--cyan); }

        /* --- Итоги забега --- */
        /* Три блока в ряд: вердикт, сводка, история. На узком экране складываются
           в столбец — порядок тот же, что и приоритет чтения. */
        .go-body { display: flex; flex-wrap: wrap; gap: 24px; align-items: stretch; justify-content: center; margin-bottom: 24px; width: 90vw; max-width: 900px; }
        .go-verdict, .go-sheet, .go-board { background: var(--panel); border: 1px solid var(--line); padding: 24px; }
        .go-verdict { border-left: 3px solid var(--red); min-width: 200px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
        .go-sheet { border-left: 3px solid var(--cyan); flex: 1; min-width: 260px; }
        .go-board { border-left: 3px solid var(--line); min-width: 160px; }

        .go-grade-label { font-size: 10px; color: var(--txt-dim); margin-bottom: 16px; }
        #go-grade { font-size: 88px; line-height: 1; color: var(--txt-mute); }
        .go-grade-why { font-family: var(--font-ui); font-size: 13px; line-height: 1.5; color: var(--txt-dim); margin-top: 16px; }

        #go-stats { font-size: 12px; line-height: 1.9; color: var(--cyan); text-align: left; }
        .go-breakdown { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); display: grid; grid-template-columns: 1fr auto; gap: 8px 16px; }
        .go-breakdown dt { font-size: 10px; line-height: 1.6; color: var(--txt-dim); }
        .go-breakdown dd { font-size: 10px; line-height: 1.6; color: var(--txt); margin: 0; text-align: right; }
        .go-breakdown dd.hi { color: var(--gold); }

        .go-board-label { font-size: 10px; color: var(--txt-dim); margin-bottom: 16px; }
        #go-leaderboard { font-size: 10px; line-height: 1.9; color: var(--txt-mute); }
        #go-leaderboard .is-run { color: var(--gold); }

        /* Оценка красится тем же набором, что и ранг в HUD */
        .grade-p { color: var(--cyan) !important; }
        .grade-s { color: var(--blue) !important; }
        .grade-a { color: var(--magenta) !important; }
        .grade-b { color: var(--green) !important; }
        .grade-c { color: var(--gold) !important; }
        .grade-d { color: var(--txt-mute) !important; }

        /* Заголовок смерти обязан ударить. Один проход глитча на появлении:
           повторяющийся — превращается в обои и перестаёт читаться. */
        #go-title {
            text-shadow: 0 0 28px currentColor, 3px 0 0 rgba(0,224,255,0.45), -3px 0 0 rgba(255,47,208,0.45);
            animation: goGlitch 620ms steps(2) 1;
        }
        @keyframes goGlitch {
            0%   { transform: translateX(-10px) skewX(-8deg); opacity: 0; letter-spacing: 8px; }
            25%  { transform: translateX(8px)   skewX(6deg);  opacity: 1; }
            50%  { transform: translateX(-4px); }
            75%  { transform: translateX(3px)  skewX(-2deg); }
            100% { transform: none; letter-spacing: normal; }
        }

        /* Буква оценки — главный итог экрана. Свет по ней держит взгляд
           на секунду дольше, чем держал бы просто крупный шрифт. */
        #go-grade {
            text-shadow: 0 0 34px currentColor;
            animation: gradeIn 420ms cubic-bezier(.2,1.5,.4,1) 1;
        }
        @keyframes gradeIn {
            from { transform: scale(0.4); opacity: 0; }
            to   { transform: none; opacity: 1; }
        }

        /* Строка итогов въезжает лесенкой: сводка читается сверху вниз,
           и порядок появления задаёт тот же порядок чтения. */
        .go-verdict { animation: goCol 260ms ease-out 1 both; }
        .go-sheet   { animation: goCol 260ms ease-out 60ms 1 both; }
        .go-board   { animation: goCol 260ms ease-out 120ms 1 both; }
        @keyframes goCol { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }

        /* Кнопка «снова вниз» подсвечивается сама: после смерти игрок
           ищет глазами именно её, и она не должна выглядеть как остальные. */
        #game-over-screen .menu-btn.primary { animation: againPulse 1800ms ease-in-out infinite alternate; }
        @keyframes againPulse {
            from { box-shadow: 0 0 0 rgba(255,47,208,0); }
            to   { box-shadow: 0 0 34px rgba(255,47,208,0.55); }
        }

        /* Тост о достижении: въезжает сбоку, а не проявляется.
           Проявление на тёмном фоне глаз не ловит — движение ловит. */
        .achievement-toast { animation: toastIn 220ms cubic-bezier(.2,1.4,.4,1) 1; }
        @keyframes toastIn { from { transform: translateX(-120%); } to { transform: none; } }

        @media (prefers-reduced-motion: reduce) {
            #go-title, #go-grade, .go-verdict, .go-sheet, .go-board,
            #game-over-screen .menu-btn.primary, .achievement-toast { animation: none; }
        }
    `;
    document.head.appendChild(style);

    // Покупка не должна раствориться: игрок идёт в забег, ЗНАЯ, что тот будет
    // другим. Поэтому плашка висит на последнем экране перед стартом и гаснет
    // только после того, как забег начался.
    // Кнопка на глубину, а не список: пять кнопок в ряд читаются за один
    // взгляд, выпадающий список — нет.
    window.pickDepthBtn = function(n) {
        if (!setDepth(n)) return;
        playSFX(sfxUiNav, 0.4);
        renderDepthPicker();
    };

    function renderDepthPicker() {
        const wrap = document.getElementById('depth-picker');
        const info = document.getElementById('depth-info');
        if (!wrap) return;
        const cur = selectedDepth();
        let html = '';
        for (let n = DEPTH_MIN; n <= DEPTH_MAX; n++) {
            const open = depthUnlocked(n);
            html += `<button class="menu-btn depth-btn${n === cur ? ' is-on' : ''}${open ? '' : ' is-disabled'}" `
                + `${open ? `onclick="pickDepthBtn(${n})"` : 'disabled'}>${open ? n : '🔒'}</button>`;
        }
        wrap.innerHTML = html;
        if (!info) return;
        const locked = !depthUnlocked(DEPTH_MAX);
        const prevRun = runDepth;
        runDepth = cur;   // множители считаются от выбранной, а не от прошлого забега
        info.innerHTML = `<b>${DEPTH_NAMES[cur]}</b> · ЯДРА <b>×${depthCoreMult().toFixed(1)}</b>`
            + ` · ВРАГОВ <b>×${depthSpawnDiv().toFixed(1)}</b> · БОССЫ <b>×${depthBossHpMult().toFixed(2)} HP</b><br>`
            + `РЕКОРД НА ЭТОЙ ГЛУБИНЕ <b>${depthBest(cur).toString().padStart(4, '0')}</b>`
            + (cur >= DEPTH_LEGENDARY_FROM ? ` · <span style="color:var(--gold);">ЛЕГЕНДАРКИ ПАДАЮТ</span>`
                                           : ` · <span style="color:var(--txt-mute);">ЛЕГЕНДАРКИ С ГЛУБИНЫ ${DEPTH_LEGENDARY_FROM}</span>`)
            + (locked ? `<br><span style="color:var(--txt-mute);">ГЛУБИНА ${DEPTH_MAX} ОТКРОЕТСЯ ПОСЛЕ ПОБЕДЫ НА ${DEPTH_MAX - 1}</span>` : '');
        runDepth = prevRun;
    }

    function renderPoolBanner() {
        const el = document.getElementById('pool-banner');
        if (!el) return;
        const fresh = freshUnlocks();
        el.style.display = fresh.length ? 'block' : 'none';
        if (!fresh.length) return;
        el.innerHTML = `<div class="pb-head">НОВОЕ В ПУЛЕ: ${fresh.length}</div>`
            + fresh.map(n => `<div class="pb-row"><span class="pb-tag">${n.pool}</span><span class="pb-what">${n.title}</span></div>`).join('');
    }

    window.showPartSelectBtn = function() {
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('part-select-screen').style.display = 'flex';
        renderPoolBanner();
        renderDepthPicker();
    };
    window.hidePartSelectBtn = function() {
        document.getElementById('part-select-screen').style.display = 'none';
        document.getElementById('main-menu-screen').style.display = 'flex';
    };
    window.showComingSoonBtn = function() {
        document.getElementById('part-select-screen').style.display = 'none';
        document.getElementById('coming-soon-screen').style.display = 'flex';
    };
    window.hideComingSoonBtn = function() {
        document.getElementById('coming-soon-screen').style.display = 'none';
        document.getElementById('part-select-screen').style.display = 'flex';
    };

    window.startGameBtn = function() {
        const fade = document.getElementById('fade-overlay');
        fade.style.opacity = '1';
        setTimeout(() => {
            closeAllScreens();
            markUnlocksSeen();
            if (isMobile) coopMode = false;   // страховка: на телефоне ко-опа нет
            initGameCore();
            if (p2UiContainer) p2UiContainer.style.display = coopMode ? 'flex' : 'none';
            gameState = 'playing';
            playBGM(bgmFight);
            triggerStartGlitch();
            showControlHints();
            requestAnimationFrame(() => { fade.style.opacity = '0'; });
        }, 550);
    };
    function updateCoopToggleLabel() {
        const btn = document.getElementById('coop-toggle-btn');
        if (!btn) return;
        if (!coopMode) {
            // Соло — но устройство можно выбрать своё (клавиатура+мышь или геймпад)
            btn.innerText = player1InputMode === 'keyboard' ? 'УПРАВЛЕНИЕ: КЛАВИАТУРА' : 'УПРАВЛЕНИЕ: ГЕЙМПАД';
            return;
        }
        if (player2InputMode === 'keyboard') { btn.innerText = 'КО-ОП: ВКЛ (P2 — СТРЕЛКИ)'; return; }
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads[player2InputMode];
        btn.innerText = 'КО-ОП: ВКЛ (P2 — ' + (gp ? gp.id.slice(0, 20).toUpperCase() : 'ГЕЙМПАД') + ')';
    }
    let coopPanelInterval = null;
    window.showCoopPanelBtn = function() {
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('coop-device-panel').style.display = 'flex';
        renderCoopDeviceList();
        coopPanelInterval = setInterval(renderCoopDeviceList, 700);
    };
    window.hideCoopPanelBtn = function() {
        if (coopPanelInterval) { clearInterval(coopPanelInterval); coopPanelInterval = null; }
        document.getElementById('coop-device-panel').style.display = 'none';
        document.getElementById('main-menu-screen').style.display = 'flex';
        updateCoopToggleLabel();
    };
    window.selectP1Device = function(mode) {
        player1InputMode = mode; // 'keyboard' (мышь+клава) или индекс геймпада
        // Один геймпад не может управлять двумя игроками — иначе стик двигает обоих сразу
        if (mode !== 'keyboard' && player2InputMode === mode) player2InputMode = 'keyboard';
        renderCoopDeviceList();
        const note = document.getElementById('coop-selected-note');
        if (note) note.innerText = 'P1: ' + (mode === 'keyboard' ? 'КЛАВИАТУРА + МЫШЬ' : 'ГЕЙМПАД');
    };
    window.selectP2Device = function(mode) {
        if (isMobile) {
            const n = document.getElementById('coop-selected-note');
            if (n) n.innerText = 'КО-ОП НЕДОСТУПЕН НА ТЕЛЕФОНЕ: ВТОРОМУ НУЖНЫ СВОИ КЛАВИШИ';
            return;
        }
        coopMode = true;
        player2InputMode = mode; // 'keyboard' или индекс геймпада
        if (mode !== 'keyboard' && player1InputMode === mode) player1InputMode = 'keyboard';
        renderCoopDeviceList();
        const note = document.getElementById('coop-selected-note');
        if (note) note.innerText = 'P2 ВЫБРАН — МОЖНО ЗАКРЫВАТЬ';
    };
    window.disableCoopBtn = function() {
        coopMode = false;
        player2InputMode = 'keyboard';
        renderCoopDeviceList();
        const note = document.getElementById('coop-selected-note');
        if (note) note.innerText = 'КО-ОП ВЫКЛЮЧЕН';
    };
    function renderCoopDeviceList() {
        const listEl = document.getElementById('coop-device-list');
        const p1ListEl = document.getElementById('p1-device-list');
        const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g && g.connected) : [];

        function buildRows(currentMode, selectFn) {
            const kbSelected = currentMode === 'keyboard';
            let html = `<div class="dev-row${kbSelected ? ' selected' : ''}">
                <div class="dev-name">KB — КЛАВИАТУРА${selectFn === 'selectP1Device' ? ' + МЫШЬ' : ' (СТРЕЛКИ + ENTER)'}</div>
                <button class="menu-btn" onclick="${selectFn}('keyboard')" style="width:auto; margin:0; padding:8px 16px; text-align:center;">${kbSelected ? 'ВЫБРАНО' : 'ВЫБРАТЬ'}</button>
            </div>`;
            if (pads.length === 0) {
                html += `<div class="dev-note" style="text-align:center; padding:12px;">Геймпады не найдены.</div>`;
            } else {
                for (const gp of pads) {
                    const selected = currentMode === gp.index;
                    const pressedNow = gp.buttons.findIndex(b => b.pressed);
                    html += `<div class="dev-row${selected ? ' selected' : ''}" style="flex-direction:column; align-items:stretch; gap:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
                            <div class="dev-name" style="max-width:260px;">PAD — ${gp.id}</div>
                            <button class="menu-btn" onclick="${selectFn}(${gp.index})" style="width:auto; margin:0; padding:8px 16px; text-align:center;">${selected ? 'ВЫБРАНО' : 'ВЫБРАТЬ'}</button>
                        </div>
                        <div class="dev-note">Нажатая кнопка: ${pressedNow >= 0 ? '<span style="color:var(--green);">#' + pressedNow + '</span>' : '—'} (нажми любую, чтобы увидеть номер)</div>
                    </div>`;
                }
            }
            return html;
        }

        if (p1ListEl) p1ListEl.innerHTML = buildRows(player1InputMode, 'selectP1Device');
        if (listEl) listEl.innerHTML = buildRows(coopMode ? player2InputMode : '__none__', 'selectP2Device');
    }

    let shopReturn = 'menu';
    let shopTab = 'upgrades';
    window.switchShopTab = function(tab) {
        if (shopTab === tab) return;
        shopTab = tab;
        playSFX(sfxUiNav, 0.4);
        renderShop();
        resetMenuFocus();   // фокус клавиатуры съезжает при смене вкладки
        // Списки разной длины: без сброса вторая вкладка открывается с середины
        const scr = document.getElementById('shop-screen');
        if (scr) scr.scrollTop = 0;
    };
    window.showShopBtn = function(from) {
        shopReturn = from || 'menu';
        shopTab = 'upgrades';
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'none';
        const scr = document.getElementById('shop-screen');
        scr.style.display = 'flex';
        scr.scrollTop = 0;
        renderShop();
    };
    window.hideShopBtn = function() {
        document.getElementById('shop-screen').style.display = 'none';
        if (shopReturn === 'gameover') document.getElementById('game-over-screen').style.display = 'flex';
        else document.getElementById('main-menu-screen').style.display = 'flex';
        updateMenuStats();
    };
    window.buyUpgrade = function(id) {
        const cost = upCost(id);
        if (cost === null) return;
        const w = saveData.wallet || 0;
        if (w < cost) return;
        saveData.wallet = w - cost;
        saveData.upgrades = saveData.upgrades || {};
        saveData.upgrades[id] = upLevel(id) + 1;
        writeSave();
        playSFX(sfxAchievement, 0.7);
        renderShop();
    };
    function renderShop() {
        const wallet = saveData.wallet || 0;
        const wEl = document.getElementById('shop-wallet');
        if (wEl) wEl.innerHTML = `КОШЕЛЁК <b>${wallet} CR</b> · ЯДРА <b>${saveData.cores || 0}</b>`;

        const onUp = shopTab === 'upgrades', onTree = shopTab === 'tree';
        const tabs = { upgrades: 'shop-tab-upgrades', skins: 'shop-tab-skins', tree: 'shop-tab-tree' };
        for (const k in tabs) { const el = document.getElementById(tabs[k]); if (el) el.classList.toggle('is-off', shopTab !== k); }
        const panes = { upgrades: 'shop-pane-upgrades', skins: 'shop-pane-skins', tree: 'shop-pane-tree' };
        for (const k in panes) { const el = document.getElementById(panes[k]); if (el) el.style.display = shopTab === k ? 'block' : 'none'; }
        if (onTree) { renderTree(); return; }
        if (!onUp) { renderSkins(); return; }

        const listEl = document.getElementById('shop-list');
        if (!listEl) return;
        listEl.innerHTML = Object.keys(UPGRADES).map(id => {
            const u = UPGRADES[id], lvl = upLevel(id), cost = upCost(id);
            const maxed = cost === null;
            const can = !maxed && wallet >= cost;
            const pct = maxed ? 100 : Math.min(100, Math.round(wallet / cost * 100));
            return `<div class="shop-item${maxed ? ' maxed' : ''}${can ? ' ready' : ''}">
                <div class="shop-head">
                    <span class="shop-title">${u.title}</span>
                    <span class="shop-lvl">УР. ${lvl}/${u.max}</span>
                </div>
                <div class="shop-desc">${u.desc}</div>
                <div class="shop-buy">
                    <div class="shop-track"><div class="shop-fill" style="width:${pct}%"></div></div>
                    <div class="shop-cost">${maxed ? 'МАКСИМУМ' : (can ? cost + ' CR' : Math.min(wallet, cost) + '/' + cost)}</div>
                    <button class="menu-btn${can ? '' : ' is-disabled'}" ${can ? `onclick="buyUpgrade('${id}')"` : 'disabled'} style="width:auto; margin:0; padding:8px 16px; text-align:center;">${maxed ? '—' : 'КУПИТЬ'}</button>
                </div>
            </div>`;
        }).join('');
    }

    // Закрытый узел показываем целиком, вместе с ценой и условием: прятать
    // замки — значит прятать причину вернуться. Видна и та ветка, до которой
    // ещё далеко.
    function renderTree() {
        const listEl = document.getElementById('tree-list');
        if (!listEl) return;
        const cores = saveData.cores || 0;
        listEl.innerHTML = Object.keys(UNLOCK_NODES).map(id => {
            const n = UNLOCK_NODES[id];
            const owned = unlockOwned(id);
            const avail = unlockAvailable(id);
            const can = avail && cores >= n.cost;
            const pct = owned ? 100 : Math.min(100, Math.round(cores / n.cost * 100));
            let lock = '';
            if (!owned && !avail) {
                if (n.requires && !unlockOwned(n.requires)) lock = `ТРЕБУЕТ: ${UNLOCK_NODES[n.requires].title}`;
                else lock = `ТРЕБУЕТ ПОБЕДЫ НА ГЛУБИНЕ ${n.minDepth}`;
            }
            return `<div class="shop-item${owned ? ' maxed' : ''}${can ? ' ready' : ''}">
                <div class="shop-head">
                    <span class="shop-title">${n.title}</span>
                    <span class="shop-lvl">${owned ? 'ОТКРЫТО' : '+' + n.pool}</span>
                </div>
                <div class="shop-desc">${n.desc}${lock ? ` <span style="color:var(--txt-mute);">· ${lock}</span>` : ''}</div>
                <div class="shop-buy">
                    <div class="shop-track"><div class="shop-fill" style="width:${pct}%"></div></div>
                    <div class="shop-cost">${owned ? '—' : (avail ? `${Math.min(cores, n.cost)}/${n.cost} ЯДЕР` : n.cost + ' ЯДЕР')}</div>
                    <button class="menu-btn${can ? '' : ' is-disabled'}" ${can ? `onclick="buyUnlockBtn('${id}')"` : 'disabled'} style="width:auto; margin:0; padding:8px 16px; text-align:center;">${owned ? '—' : 'ОТКРЫТЬ'}</button>
                </div>
            </div>`;
        }).join('');
    }
    window.buyUnlockBtn = function(id) { if (buyUnlock(id)) renderShop(); };

    // Превью рисуется в канвас после вставки разметки: тайл процедурный,
    // в HTML его не вложить, а base64 на каждый рендер — лишние килобайты.
    function renderSkins() {
        const listEl = document.getElementById('skin-list');
        if (!listEl) return;
        const wallet = saveData.wallet || 0;
        const active = activeVehicleSkin();
        listEl.innerHTML = Object.keys(VEHICLE_SKINS).map(id => {
            const s = VEHICLE_SKINS[id];
            const owned = skinOwned(id), on = id === active;
            const can = !owned && wallet >= s.cost;
            const cls = on ? ' maxed' : (owned || can) ? ' ready' : '';
            const btn = on
                ? '<span class="skin-on">НАДЕТА</span>'
                : owned
                    ? `<button class="menu-btn" onclick="equipSkinBtn('${id}')" style="width:auto; margin:0; padding:8px 16px; text-align:center;">НАДЕТЬ</button>`
                    : `<button class="menu-btn${can ? '' : ' is-disabled'}" ${can ? `onclick="buySkinBtn('${id}')"` : 'disabled'} style="width:auto; margin:0; padding:8px 16px; text-align:center;">КУПИТЬ</button>`;
            return `<div class="shop-item skin-item${cls}">
                <canvas class="skin-swatch" data-skin="${id}" width="64" height="64"></canvas>
                <div class="skin-body">
                    <div class="shop-head">
                        <span class="shop-title">${s.title}</span>
                        <span class="shop-lvl">${owned ? (on ? 'АКТИВНА' : 'КУПЛЕНА') : s.cost + ' CR'}</span>
                    </div>
                    <div class="shop-desc">${s.desc}</div>
                    <div class="shop-buy">
                        <div class="shop-track"><div class="shop-fill" style="width:${owned ? 100 : Math.min(100, Math.round(wallet / s.cost * 100))}%"></div></div>
                        ${btn}
                    </div>
                </div>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.skin-swatch').forEach(cv => {
            const g = cv.getContext('2d');
            g.imageSmoothingEnabled = false;
            const tile = getSkinTile(cv.dataset.skin);
            if (tile) g.drawImage(tile, 0, 0, 64, 64);
            else { g.fillStyle = '#0d151d'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#74838c'; g.fillRect(18, 30, 28, 4); }
        });
    }

    window.buySkinBtn = function(id) {
        if (!buyVehicleSkin(id)) return;
        equipVehicleSkin(id);
        playSFX(sfxAchievement, 0.5);
        renderShop();
    };
    window.equipSkinBtn = function(id) {
        if (!equipVehicleSkin(id)) return;
        playSFX(sfxWeapon, 0.5, 0, 0.05);
        renderShop();
    };

    // Раскладка одна и та же, что в паузе: два списка клавиш разошлись бы
    // при первой же новой кнопке. В меню показываем обе роли сразу —
    // ко-оп ещё не выбран, а узнать клавиши P2 заранее игрок вправе.
    window.showKeysBtn = function() {
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('keys-screen').style.display = 'flex';
        const km = document.getElementById('keys-keymap');
        if (km) {
            km.innerHTML = PAUSE_KEYS_P1.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
                + '<div class="km-sep"></div>'
                + PAUSE_KEYS_P2.map(([k, v]) => `<dt>${k}</dt><dd>P2 · ${v}</dd>`).join('');
        }
    };
    window.hideKeysBtn = function() {
        document.getElementById('keys-screen').style.display = 'none';
        document.getElementById('main-menu-screen').style.display = 'flex';
    };

    window.showDailyBtn = function() {
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('daily-screen').style.display = 'flex';
        renderDailyScreen();
    };
    window.hideDailyBtn = function() {
        document.getElementById('daily-screen').style.display = 'none';
        document.getElementById('main-menu-screen').style.display = 'flex';
    };

    window.showAchievementsBtn = function() {
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('achievements-screen').style.display = 'flex';
        achievementsScreenOpen = true;
        currentAchTab = 'main';
        renderAchievementsScreen();
    };
    window.hideAchievementsBtn = function() {
        document.getElementById('achievements-screen').style.display = 'none';
        document.getElementById('main-menu-screen').style.display = 'flex';
        achievementsScreenOpen = false;
    };
    let currentAchTab = 'main';
    window.switchAchTab = function(tab) {
        currentAchTab = tab;
        renderAchievementsScreen();
    };
    function renderAchievementsScreen() {
        const src = currentAchTab === 'main' ? ACHIEVEMENTS : SECRETS;
        const tabMain = document.getElementById('ach-tab-main');
        const tabSecret = document.getElementById('ach-tab-secret');
        if (tabMain) tabMain.classList.toggle('is-off', currentAchTab !== 'main');
        if (tabSecret) tabSecret.classList.toggle('is-off', currentAchTab !== 'secret');

        const ids = Object.keys(src);
        const unlockedCount = ids.filter(id => saveData.achievements[id]).length;
        const progEl = document.getElementById('ach-progress');
        if (progEl) progEl.innerText = `РАЗБЛОКИРОВАНО: ${unlockedCount} / ${ids.length}`;

        const listEl = document.getElementById('ach-list');
        if (!listEl) return;
        listEl.innerHTML = ids.map(id => {
            const unlocked = !!saveData.achievements[id];
            const data = src[id];
            const title = unlocked ? data.title : (currentAchTab === 'secret' ? 'СЕКРЕТНЫЕ ДАННЫЕ' : data.title);
            const desc = unlocked ? data.desc : (currentAchTab === 'secret' ? 'Зашифровано. Найди способ разблокировать.' : data.desc);
            return `<div class="ach-item${unlocked ? ' unlocked' : ''}">
                <div class="ach-title">${title}</div>
                <div class="ach-desc">${desc}</div>
            </div>`;
        }).join('');
    }

    window.showLoreBtn = function() {
        document.getElementById('main-menu-screen').style.display = 'none';
        document.getElementById('lore-screen').style.display = 'flex';
        gameState = 'lore';
        applyLoreLang();
    };
    let currentLoreLang = 'ru';
    window.applyLoreLang = function() {
        const nodes = document.querySelectorAll('#lore-screen [data-ru]');
        nodes.forEach(el => { el.innerHTML = el.getAttribute('data-' + currentLoreLang); });
    };
    window.toggleLangBtn = function() {
        currentLoreLang = currentLoreLang === 'ru' ? 'en' : 'ru';
        applyLoreLang();
    };
    window.hideLoreBtn = function() {
        document.getElementById('lore-screen').style.display = 'none';
        document.getElementById('main-menu-screen').style.display = 'flex';
        gameState = 'menu';
    };
    window.goToMenuBtn = function() {
        const fade = document.getElementById('fade-overlay');
        fade.style.opacity = '1';
        setTimeout(() => {
            closeAllScreens();
            document.getElementById('main-menu-screen').style.display = 'flex';
            cancelQuestRespawn();
            resetInputState();
            gameState = 'menu'; playBGM(bgmMenu);
            requestAnimationFrame(() => { fade.style.opacity = '0'; });
        }, 550);
    };

    window.resumeGameBtn = resumeGame;
    window.abandonRunBtn = abandonRun;

    const bindTouchBtn = (id, code) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('touchstart', (e) => { e.preventDefault(); tapKey(code); });
    };
    bindTouchBtn('btn-dash', 'ShiftLeft');
    bindTouchBtn('btn-swap', 'KeyF');
    bindTouchBtn('btn-interact', 'KeyE');
    bindTouchBtn('btn-pulse', 'KeyQ');
}

function renderDailyScreen() {
    const d = ensureDailyDay();
    const head = document.getElementById('daily-head');
    if (head) {
        head.innerHTML = `ВЫПОЛНЕНО <b>${dailyDoneCount()}/${DAILY_COUNT}</b> · СЕРИЯ ДНЕЙ <b>${d.streak || 0}</b><br>`
            + `ЗА ВСЕ ТРИ РАЗОМ <b>+${DAILY_BONUS} CR</b>${d.bonus ? ' · ПОЛУЧЕНО' : ''}`;
    }
    const list = document.getElementById('daily-list');
    if (!list) return;
    list.innerHTML = dailyList().map(q => {
        const have = Math.min(q.goal, d.prog[q.id] || 0), done = !!d.done[q.id];
        const pct = Math.round(have / q.goal * 100);
        return `<div class="daily-item${done ? ' done' : ''}">
            <div class="daily-row"><span class="daily-title">${q.title}</span><span class="daily-reward">+${q.reward} CR</span></div>
            <div class="daily-track"><div class="daily-fill" style="width:${pct}%"></div></div>
            <div class="daily-count">${done ? 'ВЫПОЛНЕНО' : `${have} / ${q.goal}`}</div>
        </div>`;
    }).join('');
}

let _dailyBtnCache = '';
function updateDailyMenuBtn() {
    const btn = document.getElementById('daily-menu-btn');
    if (!btn) return;
    const s = `СВОДКА ДНЯ · ${dailyDoneCount()}/${DAILY_COUNT}`;
    if (s !== _dailyBtnCache) { btn.innerText = s; _dailyBtnCache = s; }
}

let _menuStatsCache = '';
function updateMenuStats() {
    const el = document.getElementById('menu-stats');
    if (!el) return;
    const ids = Object.keys(ACHIEVEMENTS).concat(Object.keys(SECRETS));
    const done = ids.filter(id => saveData.achievements[id]).length;
    const w = saveData.wallet || 0, goal = nextGoal();
    const s = `ЛУЧШИЙ СЧЁТ <b>${saveData.bestScore.toString().padStart(4, '0')}</b><br>`
            + `ЗАБЕГОВ <b>${saveData.runs.length}</b> · ОТКРЫТО <b>${done}/${ids.length}</b><br>`
            + `КОШЕЛЁК <b>${w} CR</b> · ЯДРА <b>${saveData.cores || 0}</b><br>`
            + `ДОСТУПЫ <b>${unlocksProgress().have}/${unlocksProgress().total}</b>`
            + (goal ? ` · ДО АПГРЕЙДА <b>${Math.min(w, goal.cost)}/${goal.cost}</b>` : ' · КУПЛЕНО ВСЁ');
    if (s !== _menuStatsCache) { el.innerHTML = s; _menuStatsCache = s; }
    updateDailyMenuBtn();
    renderStorageWarning();
}

// Счёт задаёт пол оценки, стиль его поднимает. Ровно два модификатора —
// иначе игрок не поймёт, за что получил букву, и перестанет на неё смотреть.
const GRADE_LETTERS = ['D', 'C', 'B', 'A', 'S', 'P'];

function runGrade() {
    let idx = 0;
    if (score >= 2000) idx = 5;
    else if (score >= 1000) idx = 4;
    else if (score >= 600) idx = 3;
    else if (score >= 300) idx = 2;
    else if (score >= 100) idx = 1;

    const why = [];
    let bonus = 0;
    if (chainBest >= 45) { bonus += 2; why.push(`цепь ${chainBest} — перегрузка`); }
    else if (chainBest >= 25) { bonus += 1; why.push(`цепь ${chainBest} — резонанс`); }

    const bossBonus = Math.floor(currentBossIndex / 2);
    if (bossBonus > 0) why.push(`боссов повержено: ${currentBossIndex}`);
    // Потолок в две ступени: иначе стиль перекрывает счёт целиком
    // и буква перестаёт что-либо говорить о забеге.
    idx += Math.min(2, bonus + bossBonus);

    idx = Math.max(0, Math.min(GRADE_LETTERS.length - 1, idx));
    return { letter: GRADE_LETTERS[idx], css: 'grade-' + GRADE_LETTERS[idx].toLowerCase(), why };
}

function formatRunTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

// === ЧТО РЯДОМ ===
// Ровно одна цель. Список «до чего осталось» игрок не читает; одну строку
// с числом — читает всегда. Выбираем по ДОЛЕ пройденного, а не по абсолютному
// остатку: 40 из 50 кредитов ближе, чем 900 из 1000 очков, хотя остаток втрое
// меньше у второго.
//
// Перевод «это один забег» честен только там, где есть история: у счёта она
// есть (saveData.runs), у кошелька — нет, доход за забег нигде не пишется.
// Врать «≈2 забега» там, где база не измерена, хуже, чем не переводить вовсе.
function avgRunScore() {
    const runs = (saveData.runs || []).slice(0, 5);
    if (!runs.length) return 0;
    return Math.round(runs.reduce((a, r) => a + r.score, 0) / runs.length);
}

function nextTarget() {
    const out = [];
    const w = saveData.wallet || 0;
    const goal = nextGoal();
    // Покупка — единственная цель, которую можно взять прямо сейчас.
    // Когда денег уже хватает, это и есть ближайшее действие, а не «осталось 0».
    if (goal) out.push({ what: `${UPGRADES[goal.id].title}: ${UPGRADES[goal.id].desc}`,
                         have: Math.min(w, goal.cost), need: goal.cost, unit: 'CR', ready: w >= goal.cost });

    // Пороговые цели показываем только недобранными: достигнутый порог —
    // это уже открытое достижение, а не то, что «рядом».
    const push = (what, have, need, unit, note) => { if (have < need) out.push({ what, have, need, unit, note }); };

    const avg = avgRunScore();
    const runsLeft = avg > 0 ? Math.max(1, Math.ceil((saveData.bestScore - score) / avg)) : 0;
    push('ПОБИТЬ СОБСТВЕННЫЙ РЕКОРД', score, saveData.bestScore, 'ОЧКОВ',
         runsLeft ? `ПО СРЕДНЕМУ ЗА ПОСЛЕДНИЕ ЗАБЕГИ — ЕЩЁ ${runsLeft}` : '');
    if (!saveData.achievements.secret_dasher) push('ФРАГМЕНТ ПАМЯТИ: ЭХО ДВИЖЕНИЯ', saveData.stats.dashCount || 0, 200, 'РЫВКОВ');
    if (!saveData.achievements.survivor_5000) push('ВЫЖИВШИЙ: 5000 ОЧКОВ ЗА ЗАБЕГ', Math.max(score, saveData.bestScore), 5000, 'ОЧКОВ');

    if (!out.length) return null;
    // Готовая покупка идёт первой, остальное — по доле пройденного: 40 из 50
    // ближе, чем 900 из 1000, хотя абсолютный остаток втрое меньше у второго.
    out.sort((a, b) => (b.ready ? 1 : 0) - (a.ready ? 1 : 0) || (b.have / b.need) - (a.have / a.need));
    return out[0];
}

function renderGameOverStats(isNewBest, lostCredits = 0, bankedCredits = 0) {
    const prevChain = saveData.stats.bestChain || 0;
    const chainRecord = chainBest > prevChain;
    if (chainRecord) { saveData.stats.bestChain = chainBest; writeSave(); }

    // Заголовок и есть главная разница между двумя концовками: игрок должен
    // видеть, что ушёл сам, а не погиб
    const title = document.getElementById('go-title');
    if (title) {
        title.innerText = runEscaped ? 'ВЫШЕЛ СВОИМ ХОДОМ' : 'CRITICAL ERROR';
        title.style.color = runEscaped ? 'var(--green)' : 'var(--red)';
    }

    const g = runGrade();
    const gradeEl = document.getElementById('go-grade');
    if (gradeEl) { gradeEl.innerText = g.letter; gradeEl.className = g.css; }
    const whyEl = document.getElementById('go-grade-why');
    if (whyEl) whyEl.innerText = g.why.length ? g.why.join(' · ') : 'счёт держит букву. стиль поднимает её выше';

    const statsEl = document.getElementById('go-stats');
    if (statsEl) {
        statsEl.innerHTML = `<span style="color:var(--magenta);">ЯДРА: +${runCores}</span>`
            + `<span style="color:var(--txt-dim);"> · ВСЕГО ${saveData.cores || 0}</span><br>`
            + `SCORE: ${score.toString().padStart(4, '0')}${isNewBest ? ' <span style="color:var(--gold);">NEW BEST</span>' : ''}<br>BEST: ${saveData.bestScore.toString().padStart(4, '0')}`
            + `<br><span style="color:var(--txt-dim);">КОШЕЛЁК: </span><span style="color:var(--gold);">${saveData.wallet || 0} CR</span>`
            + (lostCredits > 0 ? `<br><span style="color:var(--red);">ПОТЕРЯНО: ${lostCredits} CR</span>` : '')
            + (bankedCredits > 0 ? `<br><span style="color:var(--green);">ВЫВЕЗЕНО: ${bankedCredits} CR</span>` : '')
            + (divesTaken > 0 ? `<br><span style="color:var(--txt-dim);">ГЛУБИН ПОДРЯД: </span><span style="color:var(--amber);">${divesTaken} (x${diveMult})</span>` : '')
            + (bestDropTier >= 0 ? `<br><span style="color:var(--txt-dim);">ЛУЧШИЙ ДРОП: </span><span style="color:${DROP_TIERS[bestDropTier].color};">${bestDropName}</span>` : '')
            + `<br><span style="color:var(--txt-dim);">ЛЕГЕНДАРОК ВСЕГО: </span><span style="color:var(--gold);">${saveData.stats.legendaries || 0}</span>`;
    }

    const brEl = document.getElementById('go-breakdown');
    if (brEl) {
        const goal = nextGoal(), w = saveData.wallet || 0;
        const rows = [
            ['ПОД ВОДОЙ', formatRunTime(worldTimer), false],
            ['ЛУЧШАЯ ЦЕПЬ', `x${chainBest}${chainRecord ? ' ★' : ''}`, chainRecord],
            ['ГЛУБИНА', `${runDepth} · ${DEPTH_NAMES[runDepth]}`, runDepth >= DEPTH_LEGENDARY_FROM],
            ['РЕКОРД ГЛУБИНЫ', depthBest(runDepth).toString().padStart(4, '0'), score >= depthBest(runDepth)],
            ['БОССОВ', String(currentBossIndex), false],
            ['ТРАНСПОРТА', String(vehicleKillsThisRun), false]
        ];
        // Следующая покупка — то, ради чего стоит нажать «перезагрузку»
        if (goal) rows.push(['ДО АПГРЕЙДА', `${Math.min(w, goal.cost)}/${goal.cost} CR`, w >= goal.cost]);
        brEl.innerHTML = rows.map(([k, v, hi]) => `<dt>${k}</dt><dd${hi ? ' class="hi"' : ''}>${v}</dd>`).join('');
    }

    const unEl = document.getElementById('go-unlocks');
    if (unEl) {
        unEl.style.display = runUnlocks.length ? 'flex' : 'none';
        unEl.innerHTML = runUnlocks.map(u => `<div class="go-unlock">`
            + `<div class="gu-tag">${u.secret ? 'ЗАКРЫТЫЕ ДАННЫЕ' : 'ВЫБИТО В ЭТОМ ЗАБЕГЕ'}</div>`
            + `<div class="gu-title">${u.title}</div>`
            + (u.reward ? `<div class="gu-reward">${u.reward}</div>` : '')
            + `</div>`).join('');
    }

    const nextEl = document.getElementById('go-next');
    if (nextEl) {
        const t = nextTarget();
        if (!t) {
            nextEl.innerHTML = '<div class="gn-what">ОТКРЫТО ВСЁ. ДАЛЬШЕ — ТОЛЬКО ИГРАТЬ ЛУЧШЕ</div>';
        } else {
            const pct = Math.max(0, Math.min(100, Math.round(t.have / t.need * 100)));
            nextEl.innerHTML = `<div class="gn-what">${t.what}</div>`
                + `<div class="gn-gap">${t.ready ? 'ДЕНЕГ ХВАТАЕТ. ИДИ И ЗАБЕРИ' : `${t.have} / ${t.need} ${t.unit} · ОСТАЛОСЬ ${t.need - t.have}`}</div>`
                + `<div class="gn-track"><div class="gn-fill" style="width:${pct}%"></div></div>`
                + (t.note ? `<div class="gn-gap" style="margin-top:8px; color:var(--txt-dim);">${t.note}</div>` : '');
        }
    }

    const lbEl = document.getElementById('go-leaderboard');
    if (lbEl) {
        // Строку этого забега подсвечиваем: без неё в списке не найти себя
        let marked = false;
        lbEl.innerHTML = saveData.runs.slice(0, 10).map((r, i) => {
            const mine = !marked && r.score === score;
            if (mine) marked = true;
            return `<div class="${mine ? 'is-run' : ''}">${i + 1}. ${r.score.toString().padStart(4, '0')}${r.escaped ? ' <span style="color:var(--green);">↑</span>' : ''}</div>`;
        }).join('') || '<div style="color:var(--txt-mute);">ПОКА ПУСТО</div>';
    }
}

// --- ПАУЗА ---
// Забег останавливается целиком: gameLoop перестаёт звать update, но продолжает
// рисовать, поэтому под панелью виден замерший кадр, а не чёрный экран.

const PAUSE_KEYS_P1 = [
    ['WASD', 'ход — стоять нельзя'],
    ['ЛКМ', 'огонь'],
    ['ПКМ', 'альт-залп'],
    ['SHIFT', 'рывок сквозь пули'],
    ['SPACE', 'парировать — отбить чужое обратно'],
    ['Q', 'импульс: расшвырять всё вокруг'],
    ['F', 'сменить ствол'],
    ['E', 'влезть в транспорт / вылезти'],
    ['G / H', 'контракт: взять / отказать'],
    ['V / N', 'после сдачи: наверх или глубже'],
    ['C', 'сонар — держать'],
    ['M', 'карта'],
    ['ESC', 'пауза']
];

const PAUSE_KEYS_P2 = [
    ['СТРЕЛКИ', 'ход'],
    ['—', 'стреляет сам по ближайшей цели'],
    ['ENTER', 'рывок'],
    ['RIGHT CTRL', 'парировать'],
    ['.', 'импульс'],
    ['\\', 'транспорт']
];

function renderPauseScreen() {
    const km = document.getElementById('pause-keymap');
    if (km) {
        let rows = PAUSE_KEYS_P1.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
        if (coopMode && player2) {
            rows += '<div class="km-sep"></div>';
            rows += PAUSE_KEYS_P2.map(([k, v]) => `<dt>${k}</dt><dd>P2 · ${v}</dd>`).join('');
        }
        km.innerHTML = rows;
    }
    const st = document.getElementById('pause-stats');
    if (st) {
        st.innerHTML = `SCORE <b>${score.toString().padStart(4, '0')}</b> · В ВОДЕ <b>${formatRunTime(worldTimer)}</b><br>`
                     + `ЛУЧШАЯ ЦЕПЬ <b>x${chainBest}</b> · НА КОНУ <b>${runCredits} CR</b>`;
    }
    const warn = document.getElementById('pause-warn');
    // Предупреждение только когда есть что терять — иначе это просто шум.
    if (warn) warn.innerText = runCredits > 0 ? `БРОСИШЬ СЕЙЧАС — ${runCredits} CR ОСТАНУТСЯ НА ДНЕ` : '';
}

function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    // Alt-Tab и пауза — одна и та же проблема: без сброса клавиша остаётся зажатой
    resetInputState();
    document.body.classList.remove('is-critical');
    if (currentBGM) currentBGM.volume = 0.15;
    renderPauseScreen();
    const scr = document.getElementById('pause-screen');
    if (scr) scr.style.display = 'flex';
    resetMenuFocus();
}

function resumeGame() {
    if (gameState !== 'paused') return;
    const scr = document.getElementById('pause-screen');
    if (scr) scr.style.display = 'none';
    if (currentBGM) currentBGM.volume = 0.5;
    // lastFrameTime отстал на всю паузу; потолок dt в gameLoop гасит скачок,
    // но честнее начать отсчёт заново.
    lastFrameTime = performance.now();
    gameState = 'playing';
    updateCriticalState();
    resetMenuFocus();
}

function abandonRun() {
    const scr = document.getElementById('pause-screen');
    if (scr) scr.style.display = 'none';
    if (currentBGM) currentBGM.volume = 0.5;
    gameState = 'playing';   // triggerGameOver ждёт живой забег
    triggerGameOver();
}

// --- НАВИГАЦИЯ ПО МЕНЮ С КЛАВИАТУРЫ ---
// Игра управляется с WASD и геймпада — тянуться к мыши ради кнопки «начать»
// каждый раз неудобно.

// Порядок важен: пауза перекрывает всё остальное, лор — самый нижний слой.
const MENU_SCREENS = [
    'levelup-screen', 'pause-screen', 'coming-soon-screen', 'part-select-screen', 'shop-screen',
    'achievements-screen', 'daily-screen', 'keys-screen', 'coop-device-panel', 'lore-screen',
    'game-over-screen', 'main-menu-screen'
];

const MENU_ESCAPE = {
    'part-select-screen': 'hidePartSelectBtn',
    'coming-soon-screen': 'hideComingSoonBtn',
    'shop-screen': 'hideShopBtn',
    'achievements-screen': 'hideAchievementsBtn',
    'daily-screen': 'hideDailyBtn',
    'keys-screen': 'hideKeysBtn',
    'coop-device-panel': 'hideCoopPanelBtn',
    'lore-screen': 'hideLoreBtn'
};

let _kbIndex = -1;

function activeMenuScreen() {
    for (const id of MENU_SCREENS) {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none' && el.offsetParent !== null) return el;
    }
    return null;
}

function screenShown(id) {
    const el = document.getElementById(id);
    return !!el && el.style.display !== 'none' && el.offsetParent !== null;
}

// Закрывает всё разом. Перечислять экраны поштучно в каждой кнопке — как было
// раньше — значит однажды забыть один: магазин именно так и оставался висеть
// поверх игры после «перезагрузки».
function closeAllScreens() {
    MENU_SCREENS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    resetMenuFocus();
}

// draw() каждый кадр возвращает экран поражения, если тот скрыт. Пока сверху
// открыт магазин или достижения, делать этого нельзя: экран поражения всплывал
// поверх них и прятал магазин под собой.
function gameOverScreenBlocked() {
    return MENU_SCREENS.some(id => id !== 'game-over-screen' && screenShown(id));
}

function resetMenuFocus() {
    document.querySelectorAll('.menu-btn.is-kb').forEach(b => b.classList.remove('is-kb'));
    _kbIndex = -1;
}

function menuButtons(screen) {
    return Array.from(screen.querySelectorAll('.menu-btn'))
        .filter(b => !b.disabled && !b.classList.contains('is-disabled') && b.offsetParent !== null);
}

function moveMenuFocus(btns, dir) {
    if (_kbIndex < 0) _kbIndex = dir > 0 ? 0 : btns.length - 1;
    else _kbIndex = (_kbIndex + dir + btns.length) % btns.length;
    btns.forEach(b => b.classList.remove('is-kb'));
    const btn = btns[_kbIndex];
    btn.classList.add('is-kb');
    // scrollIntoView нужен в лоре и достижениях: списки длиннее экрана
    if (btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest' });
    playSFX(sfxUiNav, 0.3);
}

// Возвращает true, если клавишу забрало меню — тогда игровой обработчик её не видит
function handleMenuKeys(e) {
    if (gameState === 'playing') return false;
    const screen = activeMenuScreen();
    if (!screen) return false;

    if (e.code === 'Escape') {
        if (screen.id === 'pause-screen') { resumeGame(); return true; }
        const fn = MENU_ESCAPE[screen.id];
        if (fn && window[fn]) { resetMenuFocus(); window[fn](); return true; }
        return false;
    }

    const btns = menuButtons(screen);
    if (btns.length === 0) return false;

    // Карты выбора стоят в ряд: без стрелок влево-вправо экран был бы
    // проходим только вертикальными, которых на нём нет
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD') { moveMenuFocus(btns, 1); return true; }
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA') { moveMenuFocus(btns, -1); return true; }
    if (screen.id === 'levelup-screen' && /^Digit[1-3]$/.test(e.code)) {
        const i = Number(e.code.slice(5)) - 1;
        if (btns[i]) { resetMenuFocus(); btns[i].click(); return true; }
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        if (_kbIndex < 0 || !btns[_kbIndex]) return false;
        const btn = btns[_kbIndex];
        resetMenuFocus();
        btn.click();
        return true;
    }
    return false;
}
