/* Self-contained PDF generation: report pages are rendered with device fonts
   to preserve Japanese characters without external libraries or services. */
(function(){
  const encoder=new TextEncoder();
  const enc=s=>encoder.encode(s);
  const join=parts=>{const length=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(length);let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length;}return out;};
  const dataBytes=url=>{const binary=atob(url.split(',')[1]),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;};
  function buildPages(data,lang){
    const es=lang==='es',pages=[];
    let canvas,ctx,y;
    const W=1240,H=1754,left=88,right=W-88,limit=H-110;
    function start(){
      canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
      ctx=canvas.getContext('2d');ctx.fillStyle='#fffdfa';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#b94b67';ctx.fillRect(0,0,W,15);
      ctx.font='bold 37px system-ui,sans-serif';ctx.fillStyle='#292e35';ctx.fillText('日本への旅 · Japanese Learning Journey',left,94);
      ctx.font='20px system-ui,sans-serif';ctx.fillStyle='#766f75';ctx.fillText(es?'Informe de aprendizaje':'Learning report',left,135);
      ctx.strokeStyle='#ead9df';ctx.beginPath();ctx.moveTo(left,154);ctx.lineTo(right,154);ctx.stroke();
      y=202;
    }
    function finish(){pages.push(canvas);}
    function lines(text,font='24px system-ui,sans-serif',maxWidth=right-left){
      ctx.font=font;const out=[];let line='';
      for(const word of String(text??'').split(/\s+/)){
        const trial=line?line+' '+word:word;
        if(ctx.measureText(trial).width>maxWidth&&line){out.push(line);line=word;}else line=trial;
      }
      if(line)out.push(line);return out.length?out:[''];
    }
    function write(text,opts={}){
      const font=opts.bold?'bold 25px system-ui,sans-serif':opts.jp?'27px "Noto Sans JP",system-ui,sans-serif':'23px system-ui,sans-serif';
      const lh=opts.jp?48:37,all=lines(text,font);
      if(y+all.length*lh+18>limit){finish();start();}
      ctx.font=font;ctx.fillStyle=opts.color||'#2e3339';
      for(const line of all){ctx.fillText(line,left+(opts.indent||0),y);y+=lh;}
      if(opts.space)y+=opts.space;
    }
    function heading(text){if(y+110>limit){finish();start();}y+=16;write(text,{bold:true,color:'#ad4963',space:13});}
    start();
    heading(es?'Resumen':'Summary');
    write((es?'Nombre: ':'Name: ')+(data.name||'—'));
    write((es?'Fecha: ':'Date: ')+String(data.exportedAt||'').slice(0,10));
    write((es?'Tiempo activo: ':'Active time: ')+Math.round((data.activeSeconds||0)/60)+' min');
    write((es?'Intentos correctos: ':'Correct attempts: ')+(data.correctCount||0)+' / '+(data.activityCount||0));
    write((es?'Prácticas marcadas: ':'Self-reported practices: ')+(data.practiceEvents||[]).length);
    write((es?'Solicitudes de audio: ':'Audio requests: ')+(data.audioEvents||[]).length,{space:15});
    write(es?'La práctica oral no se evalúa automáticamente. Una respuesta correcta no demuestra dominio consolidado.':'Speaking is not assessed automatically. One correct answer does not prove retained mastery.',{space:12});
    heading(es?'Intentos y respuestas':'Attempts and answers');
    for(const [i,a] of (data.answers||[]).entries()){
      write((i+1)+'. '+a.question,{bold:true,space:2});
      write((es?'Tu respuesta: ':'Your answer: ')+a.response);
      write((es?'Esperada: ':'Expected: ')+a.expected);
      write((a.correct?(es?'Correcta':'Correct'):(es?'A revisar':'Needs review'))+' · '+a.lessonId+' · '+a.skill,{color:a.correct?'#31745f':'#a34a50',space:16});
    }
    heading(es?'Práctica guiada':'Guided practice');
    for(const e of data.practiceEvents||[])write(e.lessonId+' · '+e.activityId+' · '+String(e.completedAt).slice(0,16),{space:7});
    if(!(data.practiceEvents||[]).length)write(es?'No hay prácticas marcadas.':'No practices marked.');
    heading(es?'Nota de privacidad':'Privacy note');
    write(es?'Generado en tu dispositivo. Guarda este PDF para lectura y el JSON para el seguimiento con IA.':'Generated on your device. Keep this PDF for reading and the JSON for AI-assisted tracking.');
    finish();return pages;
  }
  function pdfFromPages(canvases){
    const count=canvases.length,objects=[],bytes=[];
    const put=(id,parts)=>objects[id]=Array.isArray(parts)?parts:[enc(parts)];
    put(1,'<< /Type /Catalog /Pages 2 0 R >>');
    put(2,'<< /Type /Pages /Kids ['+canvases.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] /Count '+count+' >>');
    canvases.forEach((canvas,i)=>{
      const page=3+i*3,content=page+1,img=page+2;
      put(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 '+img+' 0 R >> >> /Contents '+content+' 0 R >>');
      const stream=enc('q 595 0 0 842 0 0 cm /Im0 Do Q\n');
      put(content,[enc('<< /Length '+stream.length+' >>\nstream\n'),stream,enc('endstream')]);
      const jpeg=dataBytes(canvas.toDataURL('image/jpeg',.84));
      put(img,[enc('<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'),jpeg,enc('\nendstream')]);
    });
    const output=[enc('%PDF-1.4\n')],offsets=[0];let position=output[0].length;
    for(let id=1;id<objects.length;id++){
      offsets[id]=position;
      const parts=[enc(id+' 0 obj\n'),...objects[id],enc('\nendobj\n')];
      output.push(...parts);position+=parts.reduce((n,p)=>n+p.length,0);
    }
    const startXref=position;
    let xref='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
    for(let id=1;id<objects.length;id++)xref+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';
    xref+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+startXref+'\n%%EOF';
    output.push(enc(xref));
    return new Blob([join(output)],{type:'application/pdf'});
  }
  window.generateJapaneseReportPdf=function(data,lang){
    const canvases=buildPages(data,lang);
    return {blob:pdfFromPages(canvases),previews:canvases.map(c=>c.toDataURL('image/jpeg',.65))};
  };
})();