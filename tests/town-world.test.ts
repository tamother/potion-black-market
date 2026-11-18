import {it,expect} from 'vitest';
import {canStand,findPath,SPAWN,TOWN_STATIONS,TOWN_SPAWN} from '../src/world/model';
import {loadPosition,storePosition} from '../src/world/persistence';
it('town approaches connect around the fountain while walls and stalls block feet',()=>{
 expect(canStand(TOWN_SPAWN,'town')).toBe(true);expect(canStand({x:470,y:310},'town')).toBe(false);
 for(const st of TOWN_STATIONS){expect(canStand(st.approach,'town'),st.id).toBe(true);expect(findPath(TOWN_SPAWN,st.approach,'town').length,st.id).toBeGreaterThan(0);}
});
it('room and town positions persist independently and reject wrong-run or invalid coordinates',()=>{
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)}};
 storePosition(storage,17,{x:600,y:380,facing:'left'},'town');storePosition(storage,17,SPAWN);
 expect(loadPosition(storage,17,'town').x).toBe(600);expect(loadPosition(storage,17)).toEqual(SPAWN);expect(loadPosition(storage,18,'town')).toEqual(TOWN_SPAWN);
});
