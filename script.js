// ====== CONSTANTS ======
const TRACK_LENGTH = 52;
const HOME_STRETCH = 6;
const SAFE_MAIN_INDICES = [0,8,13,21,26,34,39,47];
const RED_START=0, GREEN_START=13, YELLOW_START=26, BLUE_START=39;
const RED_HOME_BASE=52, GREEN_HOME_BASE=58, YELLOW_HOME_BASE=64, BLUE_HOME_BASE=70;

// ====== DOM ======
const boardEl=document.getElementById("board");
const tokenLayerEl=document.getElementById("token-layer");
const startBtn=document.getElementById("btn-start");
const rollBtn=document.getElementById("btn-roll");
const currentPlayerEl=document.getElementById("current-player");
const lastRollEl=document.getElementById("last-roll");
const diceDisplayEl=document.getElementById("dice-display");
const logEl=document.getElementById("log");

// ====== BOARD ======
const cells=[];
for(let r=0;r<15;r++){for(let c=0;c<15;c++){const cell=document.createElement("div");cell.classList.add("cell");boardEl.appendChild(cell);cells.push(cell);}}
function markHome(r1,r2,c1,c2,color){for(let r=r1;r<r2;r++)for(let c=c1;c<c2;c++)cells[r*15+c].classList.add("home",color);}
markHome(0,6,0,6,"red");markHome(0,6,9,15,"green");markHome(9,15,0,6,"yellow");markHome(9,15,9,15,"blue");
for(let r=6;r<=8;r++)for(let c=6;c<=8;c++)cells[r*15+c].classList.add("center");

// ====== MAIN TRACK ======
const mainTrack=[];
for(let c=0;c<6;c++)mainTrack.push(6*15+c);
for(let r=5;r>=0;r--)mainTrack.push(r*15+6);
for(let c=7;c<15;c++)mainTrack.push(0*15+c);
for(let r=1;r<=5;r++)mainTrack.push(r*15+8);
for(let c=9;c<15;c++)mainTrack.push(6*15+c);
for(let r=7;r<15;r++)mainTrack.push(r*15+8);
for(let c=7;c>=0;c--)mainTrack.push(14*15+c);
for(let r=13;r>=7;r--)mainTrack.push(r*15+6);
while(mainTrack.length>TRACK_LENGTH)mainTrack.pop();
mainTrack.forEach((idx,i)=>{cells[idx].classList.add("path");if(SAFE_MAIN_INDICES.includes(i))cells[idx].classList.add("safe");});

// ====== HOME TRACKS ======
const redHomeTrack=[],greenHomeTrack=[],yellowHomeTrack=[],blueHomeTrack=[];
for(let c=1;c<=6&&redHomeTrack.length<HOME_STRETCH;c++){ redHomeTrack.push(7*15+c); cells[7*15+c].classList.add("path","red"); }
for(let r=1;r<=6&&greenHomeTrack.length<HOME_STRETCH;r++){ greenHomeTrack.push(r*15+7); cells[r*15+7].classList.add("path","green"); }
for(let c=1;c<=6&&yellowHomeTrack.length<HOME_STRETCH;c++){ yellowHomeTrack.push(8*15+c); cells[8*15+c].classList.add("path","yellow"); }
for(let c=8;c<14&&blueHomeTrack.length<HOME_STRETCH;c++){ blueHomeTrack.push(8*15+c); cells[8*15+c].classList.add("path","blue"); }

// ====== PLAYERS ======
const players=[
  {color:"red",name:"",startIndex:RED_START,homeBase:RED_HOME_BASE,homeTrack:redHomeTrack,tokens:[-1,-1,-1,-1],finished:0},
  {color:"green",name:"",startIndex:GREEN_START,homeBase:GREEN_HOME_BASE,homeTrack:greenHomeTrack,tokens:[-1,-1,-1,-1],finished:0},
  {color:"yellow",name:"",startIndex:YELLOW_START,homeBase:YELLOW_HOME_BASE,homeTrack:yellowHomeTrack,tokens:[-1,-1,-1,-1],finished:0},
  {color:"blue",name:"",startIndex:BLUE_START,homeBase:BLUE_HOME_BASE,homeTrack:blueHomeTrack,tokens:[-1,-1,-1,-1],finished:0},
];

let activePlayers=[],currentPlayerIndex=0,currentRoll=null,awaitingMove=false;

// ====== UTILS ======
function addLog(text){ const div=document.createElement("div"); div.classList.add("log-entry"); div.innerHTML=text; logEl.prepend(div);}
function rollEmoji(r){ const map={1:"⚀",2:"⚁",3:"⚂",4:"⚃",5:"⚄",6:"⚅"}; return map[r]||"🎲";}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function updateCurrentPlayerUI(){ if(activePlayers.length===0){currentPlayerEl.textContent="—"; return;} const p=players[activePlayers[currentPlayerIndex]]; currentPlayerEl.textContent=`${capitalize(p.color)} (${p.name||"?"})`;}
function prankRoll(name){ const isCodeRed=name.trim().toLowerCase()==="code red"; if(isCodeRed && Math.random()<0.5){return Math.random()<0.5?5:6;} return Math.floor(Math.random()*6)+1;}

// ====== TOKEN RENDERING ======
function clearTokens(){tokenLayerEl.innerHTML="";}
function renderTokens(){ clearTokens();
  players.forEach((p,pIndex)=>{
    p.tokens.forEach((pos,tIndex)=>{
      if(pos===100)return;
      const tokenDiv=document.createElement("div"); tokenDiv.classList.add("token-visual");
      let cellIndex=null;
      if(pos===-1){ let baseRow,baseCol;if(p.color==="red"){baseRow=1;baseCol=1;} else if(p.color==="green"){baseRow=1;baseCol=12;} else if(p.color==="yellow"){baseRow=12;baseCol=1;} else{baseRow=12;baseCol=12;} const offsetRow=Math.floor(tIndex/2), offsetCol=tIndex%2; cellIndex=(baseRow+offsetRow)*15+(baseCol+offsetCol); }
      else if(pos>=0 && pos<TRACK_LENGTH) cellIndex=mainTrack[pos];
      else if(pos>=p.homeBase && pos<p.homeBase+HOME_STRETCH) cellIndex=p.homeTrack[pos-p.homeBase];
      if(cellIndex==null) return;
      const cell=cells[cellIndex];
      const rect=cell.getBoundingClientRect(), boardRect=boardEl.getBoundingClientRect();
      const x=rect.left-boardRect.left, y=rect.top-boardRect.top;
      tokenDiv.style.left=x+"px"; tokenDiv.style.top=y+"px"; tokenDiv.style.width=rect.width+"px"; tokenDiv.style.height=rect.height+"px";
      const inner=document.createElement("div"); inner.classList.add("token",p.color); inner.dataset.playerIndex=pIndex; inner.dataset.tokenIndex=tIndex;
      inner.addEventListener("click",()=>moveToken(pIndex,tIndex));
      tokenDiv.appendChild(inner); tokenLayerEl.appendChild(tokenDiv);
    });
  });
}

// ====== GAME LOGIC ======
function startGame(){
  activePlayers=[];
  ["red","green","yellow","blue"].forEach((c,i)=>{
    const name=document.getElementById("player-"+c).value.trim();
    if(name!=="") { players[i].name=name; activePlayers.push(i);}
  });
  if(activePlayers.length===0){ alert("Enter at least 1 player"); return;}
  players.forEach(p=>{p.tokens=[-1,-1,-1,-1];p.finished=0;});
  currentPlayerIndex=0; updateCurrentPlayerUI(); addLog("Game started!"); rollBtn.disabled=false; renderTokens();
}

function rollDice(){
  const p=players[activePlayers[currentPlayerIndex]];
  currentRoll=prankRoll(p.name);
  lastRollEl.textContent=currentRoll;
  diceDisplayEl.textContent=rollEmoji(currentRoll);
  awaitingMove=true;
  highlightMovableTokens();
}

// Check which tokens can move
function highlightMovableTokens(){
  const p=players[activePlayers[currentPlayerIndex]];
  let canMove=false;
  p.tokens.forEach((pos,i)=>{
    if(pos===-1 && currentRoll===6) canMove=true;
    else if(pos>=0 && pos<TRACK_LENGTH+HOME_STRETCH) canMove=true;
  });
  if(!canMove){ addLog(`${capitalize(p.color)} (${p.name}) cannot move.`); nextTurn(); return;}
  renderTokens();
  tokenLayerEl.querySelectorAll(".token").forEach(el=>{
    const pi=parseInt(el.dataset.playerIndex,10), ti=parseInt(el.dataset.tokenIndex,10);
    if(pi===activePlayers[currentPlayerIndex]) el.classList.add("highlight");
    else el.classList.remove("highlight");
  });
}

function moveToken(pIndex,tIndex){
  if(!awaitingMove || activePlayers[currentPlayerIndex]!==pIndex) return;
  const p=players[pIndex];
  let pos=p.tokens[tIndex];
  if(pos===-1 && currentRoll!==6) return;
  if(pos===-1) pos=0;
  else pos+=currentRoll;
  if(pos>=TRACK_LENGTH){ pos=p.homeBase + (pos-TRACK_LENGTH); if(pos>=p.homeBase+HOME_STRETCH) pos=100; p.finished++; addLog(`${capitalize(p.color)} (${p.name}) finished a token!`); }
  p.tokens[tIndex]=pos;
  awaitingMove=false;
  captureTokens(pIndex,pos);
  renderTokens();
  if(p.finished===4){ addLog(`${capitalize(p.color)} (${p.name}) won!`); rollBtn.disabled=true; return;}
  if(currentRoll!==6) nextTurn(); else{ addLog(`${capitalize(p.color)} (${p.name}) rolled 6, play again!`);}
}

function captureTokens(activeIndex,pos){
  if(pos<0 || pos>=TRACK_LENGTH) return;
  const mainPos=pos;
  const activePlayer=players[activeIndex];
  players.forEach((p,pi)=>{
    if(pi===activeIndex) return;
    p.tokens.forEach((t,j)=>{
      if(t===mainPos && !SAFE_MAIN_INDICES.includes(mainPos)){ p.tokens[j]=-1; addLog(`${capitalize(activePlayer.color)} captured ${capitalize(p.color)}!`);}
    });
  });
}

function nextTurn(){ currentPlayerIndex=(currentPlayerIndex+1)%activePlayers.length; updateCurrentPlayerUI();}

// ====== EVENTS ======
startBtn.addEventListener("click",startGame);
rollBtn.addEventListener("click",rollDice);
window.addEventListener("resize",renderTokens);

// Initial render
renderTokens();
