import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line
} from 'recharts'

function App() {
  const [proyectos, setProyectos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorSistema, setErrorSistema] = useState(null)
  const [busqueda, setBusqueda] = useState("")
  const [vistaActiva, setVistaActiva] = useState("analitica") 
  const [fechaReferencia, setFechaReferencia] = useState(new Date())
  const [filtroTiempo, setFiltroTiempo] = useState("Todos")

  useEffect(() => {
    obtenerProyectos()
  }, [])

  async function obtenerProyectos() {
    try {
      const { data, error } = await supabase
        .from('proyectos_main')
        .select('*, detalle_eventos(*), finanzas_proyectos(*)')
      
      if (error) throw error; 
      setProyectos(data || [])
    } catch (err) {
      console.error("Fallo crítico en ingesta:", err);
      setErrorSistema(err.message || "Fallo de conexión con el núcleo de datos.");
    } finally {
      setCargando(false)
    }
  }

  if (errorSistema) {
    return (
      <div className="flex h-screen bg-[#09090b] text-gray-300 items-center justify-center p-6">
        <div className="bg-[#121214] border border-red-900/50 p-8 rounded-xl max-w-md w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-white">Interrupción del Servicio</h2>
          </div>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            El Centro de Mando no pudo establecer conexión con el motor de base de datos. El sistema ha sido bloqueado por seguridad.
          </p>
          <div className="bg-[#09090b] p-4 rounded-md border border-gray-800 mb-6 font-mono text-xs text-red-400 overflow-hidden text-ellipsis">
            {errorSistema}
          </div>
          <button onClick={() => window.location.reload()} className="w-full py-2 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition-colors">
            Reintentar Conexión
          </button>
        </div>
      </div>
    )
  }

  // --- MOTOR DE FILTRADO MAESTRO ---
  const proyectosFiltrados = proyectos.filter(p => {
    const textoValido = p?.nombre_proyecto?.toLowerCase().includes(busqueda.toLowerCase()) || 
                        p?.id_proyecto?.toLowerCase().includes(busqueda.toLowerCase());
    if (!textoValido) return false;

    if (!p?.fecha_lanzamiento) return true; 
    
    const fechaProyecto = new Date(p.fecha_lanzamiento + 'T00:00:00');
    const hoy = new Date();

    if (filtroTiempo === "30D") {
      const limite30Dias = new Date();
      limite30Dias.setDate(hoy.getDate() - 30);
      return fechaProyecto >= limite30Dias && fechaProyecto <= hoy;
    } 
    if (filtroTiempo === "YTD") {
      const inicioAño = new Date(hoy.getFullYear(), 0, 1);
      return fechaProyecto >= inicioAño && fechaProyecto <= hoy;
    }
    return true;
  });

  // --- MOTOR DE TRANSFORMACIÓN (Limpio y conectado) ---
  const totalProyectos = proyectosFiltrados.length;
  const enEjecucion = proyectosFiltrados.filter(p => p?.estado_flujo === 'En Ejecución').length; 
  
  const aforoTotal = proyectosFiltrados.reduce((acc, p) => {
    const evento = p?.detalle_eventos?.[0]; 
    return acc + (evento?.capacidad_max_aforo ? Number(evento.capacidad_max_aforo) : 0);
  }, 0);

  const finalizados = proyectosFiltrados.filter(p => p?.estado_flujo === 'Finalizado').length;
  const tasaEficiencia = totalProyectos > 0 ? Math.round((finalizados / totalProyectos) * 100) : 0;
  
  const conteoEstados = proyectosFiltrados.reduce((acc, p) => {
    const estado = p?.estado_flujo || 'Desconocido';
    acc[estado] = (acc[estado] || 0) + 1;
    return acc;
  }, {});
  const datosPipeline = Object.keys(conteoEstados).map(key => ({ estado: key.replace('_', ' '), cantidad: conteoEstados[key] }));

  const nombresMeses = { '01':'Ene', '02':'Feb', '03':'Mar', '04':'Abr', '05':'May', '06':'Jun', '07':'Jul', '08':'Ago', '09':'Sep', '10':'Oct', '11':'Nov', '12':'Dic' };
  
  const conteoMeses = proyectosFiltrados.reduce((acc, p) => {
    if (p?.fecha_lanzamiento) {
      const mesNum = p.fecha_lanzamiento.substring(5, 7);
      const nombreMes = nombresMeses[mesNum] || mesNum;
      acc[nombreMes] = (acc[nombreMes] || 0) + 1;
    }
    return acc;
  }, {});

  const ordenMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const datosCronograma = Object.keys(conteoMeses)
    .sort((a, b) => ordenMeses.indexOf(a) - ordenMeses.indexOf(b))
    .map(key => ({ mes: key, lanzamientos: conteoMeses[key] }));

  const coloresPipeline = { 'Ideacion': '#6b7280', 'Planificacion': '#f59e0b', 'En Ejecucion': '#3b82f6', 'Finalizado': '#10b981' };

  // --- LÓGICA DE CALENDARIO ---
  const diasSemanaPeru = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const mesActual = fechaReferencia.getMonth();
  const anioActual = fechaReferencia.getFullYear();
  
  const obtenerDiasMes = (mes, anio) => {
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);
    let diaSemanaPrimerDia = primerDia.getDay() - 1;
    if (diaSemanaPrimerDia === -1) diaSemanaPrimerDia = 6; 
    
    const dias = [];
    for (let i = 0; i < diaSemanaPrimerDia; i++) dias.push(null); 
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dias.push({ dia: i, fechaCompleta: fechaStr });
    }
    return dias;
  };
  const diasCalendario = obtenerDiasMes(mesActual, anioActual);
  const nombreMesPeru = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fechaReferencia);

  // --- LÓGICA DE INTERACTIVIDAD: EXPORTACIÓN CSV ---
  const exportarDatosCSV = () => {
    if (!proyectosFiltrados || proyectosFiltrados.length === 0) {
      alert("No hay proyectos en pantalla para exportar.");
      return;
    }
    const cabeceras = ["ID Proyecto", "Nombre", "Estado", "Fecha Lanzamiento", "Aforo Proyectado"];
    const filas = proyectosFiltrados.map(p => {
      const aforo = p?.detalle_eventos?.[0]?.capacidad_max_aforo || 0;
      return [p.id_proyecto, `"${p.nombre_proyecto}"`, p.estado_flujo, p.fecha_lanzamiento || "Sin fecha", aforo].join(",");
    });
    const contenidoCSV = [cabeceras.join(","), ...filas].join("\n");
    const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Operaciones_Cinergia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-gray-300 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#09090b] border-r border-gray-800/60 hidden md:flex flex-col z-20 relative">
        <div className="h-16 flex items-center px-6 border-b border-gray-800/60">
          <div className="w-6 h-6 bg-blue-600 rounded mr-3 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <span className="text-white font-bold tracking-wide text-sm">CINERGIA OS</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          <button onClick={() => setVistaActiva("general")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${vistaActiva === 'general' ? 'bg-gray-800/80 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/30'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            Portafolio
          </button>
          <button onClick={() => setVistaActiva("analitica")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${vistaActiva === 'analitica' ? 'bg-gray-800/80 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/30'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Rendimiento
          </button>
          <button onClick={() => setVistaActiva("calendario")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${vistaActiva === 'calendario' ? 'bg-gray-800/80 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/30'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Cronograma (PE)
          </button>
        </nav>
      </aside>

      {/* ÁREA CENTRAL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#09090b]">
        
        <header className="h-16 border-b border-gray-800/60 flex items-center px-8 justify-between bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex-1 max-w-md relative">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" placeholder="Buscar por ID, área o nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full bg-[#121214] border border-gray-800 rounded-md pl-10 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600" />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-white transition-colors relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-[#09090b]"></span>
            </button>
            <div className="h-5 w-px bg-gray-800"></div>
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                C
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Directiva PE</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          
          {/* VISTA 1: PORTAFOLIO GENERAL */}
          {vistaActiva === "general" && (
            <div className="animate-in fade-in duration-300">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-white tracking-tight">Portafolio Operativo</h1>
                <p className="text-sm text-gray-500 mt-1">Directorio maestro de proyectos Cinergia.</p>
              </div>
              {cargando ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-800/20 rounded-xl border border-gray-800/50 animate-pulse"></div>)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {proyectosFiltrados.map((proyecto) => (
                    <div key={proyecto.id_proyecto} className="bg-[#121214] p-5 rounded-xl border border-gray-800/60 hover:border-gray-600 transition-colors group relative flex flex-col h-full shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="pr-4">
                          <h2 className="text-sm font-semibold text-gray-200 truncate group-hover:text-blue-400 transition-colors">{proyecto.nombre_proyecto}</h2>
                          <span className="text-[11px] text-gray-500 font-mono">{proyecto.id_proyecto}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-2 py-0.5 bg-[#18181b] text-gray-300 text-[10px] font-medium rounded-md border border-gray-800">
                          {proyecto.estado_flujo}
                        </span>
                      </div>
                      <div className="mt-auto pt-4 border-t border-gray-800/50 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Lanzamiento</span>
                          <span className="text-xs text-gray-300">
                            {proyecto.fecha_lanzamiento ? new Date(proyecto.fecha_lanzamiento + 'T00:00:00').toLocaleDateString('es-PE') : 'Sin fecha'}
                          </span>
                        </div>
                        {proyecto.url_documento ? (
                          <a href={proyecto.url_documento} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-md border border-blue-500/20 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Ver Acta
                          </a>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-gray-500 text-xs font-medium rounded-md border border-gray-800 cursor-not-allowed">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: RENDIMIENTO */}
          {vistaActiva === "analitica" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Centro de Mando Cinergia</h1>
                  <p className="text-sm text-gray-500 mt-1">Métricas operativas y flujo de trabajo estructural.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-[#121214] border border-gray-800 rounded-md p-1">
                    <button 
                      onClick={() => setFiltroTiempo("30D")}
                      className={`px-3 py-1 text-xs font-medium rounded shadow-sm transition-all ${filtroTiempo === '30D' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      30D
                    </button>
                    <button 
                      onClick={() => setFiltroTiempo("YTD")}
                      className={`px-3 py-1 text-xs font-medium rounded shadow-sm transition-all ${filtroTiempo === 'YTD' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      YTD
                    </button>
                    <button 
                      onClick={() => setFiltroTiempo("Todos")}
                      className={`px-3 py-1 text-xs font-medium rounded shadow-sm transition-all ${filtroTiempo === 'Todos' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Todos
                    </button>
                  </div>
                  <div className="h-6 w-px bg-gray-800"></div>
                  <button onClick={exportarDatosCSV} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Exportar CSV
                  </button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1 flex flex-col gap-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-5 shadow-sm relative overflow-hidden">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Volumen</p>
                      <h3 className="text-3xl font-bold text-white">{totalProyectos}</h3>
                      <p className="text-[10px] text-emerald-500 mt-2 font-medium bg-emerald-500/10 inline-block px-1.5 py-0.5 rounded border border-emerald-500/20">↑ 100% Cobertura</p>
                    </div>
                    <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-5 shadow-sm relative overflow-hidden">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Operaciones Activas</p>
                      <h3 className="text-3xl font-bold text-blue-400">{enEjecucion}</h3>
                      <p className="text-xs text-gray-500 mt-2">En ejecución directa</p>
                    </div>
                    <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-5 shadow-sm relative overflow-hidden">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Aforo Logístico</p>
                      <h3 className="text-2xl font-bold text-white">{aforoTotal.toLocaleString()} pax</h3>
                      <p className="text-xs text-gray-500 mt-2">Capacidad proyectada</p>
                    </div>
                    <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-5 shadow-sm relative overflow-hidden">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Finalización</p>
                      <h3 className="text-2xl font-bold text-amber-400">{tasaEficiencia}%</h3>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium bg-gray-800 inline-block px-1.5 py-0.5 rounded border border-gray-700">Tasa de éxito</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-gray-200 text-sm font-semibold">Carga de Lanzamientos</h3>
                        <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-1 rounded border border-gray-700">Mensual</span>
                      </div>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={datosCronograma} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="mes" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip cursor={{stroke: '#27272a', strokeWidth: 1}} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '6px' }} />
                            <Line type="monotone" dataKey="lanzamientos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#09090b', stroke: '#3b82f6', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-6 shadow-sm">
                      <h3 className="text-gray-200 text-sm font-semibold mb-6">Pipeline Operativo</h3>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={datosPipeline} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="estado" type="category" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: '#18181b'}} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '6px' }} />
                            <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} barSize={16}>
                              {datosPipeline.map((entry, index) => <Cell key={`cell-${index}`} fill={coloresPipeline[entry.estado] || '#3b82f6'} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full xl:w-80 flex flex-col gap-6">
                  <div className="bg-[#121214] border border-gray-800/60 rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">
                    <div className="p-5 border-b border-gray-800/60 flex justify-between items-center bg-[#121214] rounded-t-xl sticky top-0">
                      <h3 className="text-gray-200 text-sm font-semibold">Registro de Auditoría</h3>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div className="p-5 flex-1 overflow-y-auto">
                      <div className="relative border-l border-gray-800 ml-3 space-y-6">
                        <div className="relative pl-6">
                          <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-[#121214]"></span>
                          <p className="text-xs font-medium text-gray-300">Escudo Defensivo Activo</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">Optional Chaining en operaciones de Reducer.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: CALENDARIO */}
          {vistaActiva === "calendario" && (
            <div className="animate-in fade-in duration-300 h-full flex flex-col">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight capitalize">{nombreMesPeru} {anioActual}</h1>
                  <p className="text-sm text-gray-500 mt-1">Cronograma de lanzamientos operativos. Horario Local (PET).</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFechaReferencia(new Date(anioActual, mesActual - 1, 1))}
                    className="p-2 bg-[#121214] border border-gray-800 rounded-md hover:bg-gray-800 transition-colors text-gray-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  <button 
                    onClick={() => setFechaReferencia(new Date(anioActual, mesActual + 1, 1))}
                    className="p-2 bg-[#121214] border border-gray-800 rounded-md hover:bg-gray-800 transition-colors text-gray-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-[#121214] border border-gray-800/60 rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="grid grid-cols-7 border-b border-gray-800/60 bg-[#09090b]/50">
                  {diasSemanaPeru.map((dia, idx) => (
                    <div key={idx} className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider border-r border-gray-800/30 last:border-0">
                      {dia}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                  {diasCalendario.map((item, idx) => {
                    if (!item) return <div key={`empty-${idx}`} className="border-r border-b border-gray-800/30 bg-[#09090b]/20"></div>;
                    
                    const proyectosDelDia = proyectosFiltrados.filter(p => p?.fecha_lanzamiento === item.fechaCompleta);
                    
                    return (
                      <div key={idx} className="border-r border-b border-gray-800/30 p-2 relative hover:bg-gray-800/10 transition-colors min-h-[100px] flex flex-col">
                        <span className="text-sm font-medium text-gray-500 mb-2">{item.dia}</span>
                        <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
                          {proyectosDelDia.map(p => (
                            <div key={p.id_proyecto} className="bg-blue-600/10 border border-blue-900/50 rounded px-2 py-1 text-[10px] font-medium text-blue-400 truncate cursor-pointer hover:bg-blue-600/20 transition-colors" title={p.nombre_proyecto}>
                              {p.nombre_proyecto}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App