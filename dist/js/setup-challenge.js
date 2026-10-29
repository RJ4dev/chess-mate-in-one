// Standalone study diagrams: never feed an incomplete assembly to Chess.
export const SETUP_LESSON='board-assemble';
export const SETUP_EXERCISE={id:'assemble-initial',goal:'assemblePosition',positionKind:'setupStudy',familyId:'board-foundations',skillId:'starting-position',syncGroup:'setup-v1',prompt:'Собери начальную позицию с пустой доски.'};
export const INITIAL_SETUP=Object.freeze({a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r',a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p'});
const validSeed=seed=>Number.isInteger(seed)&&seed>=0&&seed<=4294967295;
export function setupOrder(seed){
 if(!validSeed(seed))throw Error('Invalid setup seed');
 let x=seed||0x9e3779b9;const pieces=Object.values(INITIAL_SETUP);
 for(let i=pieces.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;const j=(x>>>0)%(i+1);[pieces[i],pieces[j]]=[pieces[j],pieces[i]];}
 return pieces;
}
export const createSetup=seed=>({seed:validSeed(seed)?seed:0,squares:[],assisted:false});
export function restoreSetup(value){
 if(!value||!validSeed(value.seed)||typeof value.assisted!=='boolean'||!Array.isArray(value.squares)||value.squares.length>32)return null;
 const order=setupOrder(value.seed),used=new Set();
 for(const [i,sq] of value.squares.entries()){if(typeof sq!=='string'||!Object.hasOwn(INITIAL_SETUP,sq)||used.has(sq)||INITIAL_SETUP[sq]!==order[i])return null;used.add(sq);}
 return {seed:value.seed,squares:[...value.squares],assisted:value.assisted};
}
export function setupPieces(state){const order=setupOrder(state.seed);return Object.fromEntries(state.squares.map((sq,i)=>[sq,order[i]]));}
export function setupOptions(state){const piece=setupOrder(state.seed)[state.squares.length];return Object.keys(INITIAL_SETUP).filter(sq=>INITIAL_SETUP[sq]===piece&&!state.squares.includes(sq));}
export function placeSetup(state,square){
 if(state.squares.length===32)return state;
 if(!setupOptions(state).includes(square))return {...state,assisted:true,feedback:state.squares.includes(square)?'Здесь уже стоит фигура. Выбери свободное начальное место.':'Это не начальное место этой фигуры. Можно попробовать ещё.'};
 return {...state,squares:[...state.squares,square],feedback:''};
}
export const helpSetup=state=>({...state,assisted:true});
