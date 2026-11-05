// Online SDKs load only when their connected feature is requested.
(() => {
    const definitions = {
        supabase: {src:'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js', ready:()=>Boolean(window.supabase?.createClient)},
        microsoft: {src:'https://alcdn.msauth.net/browser/2.35.0/js/msal-browser.min.js', ready:()=>Boolean(window.msal?.PublicClientApplication)}
    };
    const pending = new Map();
    window.GFPLoadSDK = name => {
        const definition=definitions[name];
        if(!definition)return Promise.reject(new Error('Dịch vụ không hợp lệ.'));
        if(definition.ready())return Promise.resolve();
        if(pending.has(name))return pending.get(name);
        const promise=new Promise((resolve,reject)=>{
            const script=document.createElement('script');let settled=false;
            const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error);}else resolve();};
            const timer=setTimeout(()=>finish(new Error('Kết nối quá lâu. Kiểm tra mạng rồi thử lại.')),12000);
            script.src=definition.src;script.async=true;script.crossOrigin='anonymous';
            script.onload=()=>finish(definition.ready()?null:new Error('Dịch vụ chưa sẵn sàng. Hãy thử lại.'));
            script.onerror=()=>finish(new Error('Không tải được thư viện đăng nhập. Kiểm tra kết nối mạng.'));
            document.head.append(script);
        });
        pending.set(name,promise);promise.catch(()=>pending.delete(name));return promise;
    };
})();
