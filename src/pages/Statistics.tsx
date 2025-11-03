import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { CheckCircle, XCircle, Clock, Eye, MousePointerClick, FileText, FileCheck, Trash2, ChevronRight, ChevronDown, Send, Check, Search } from 'lucide-react';

interface Stats {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  totalOpened: number;
  totalClicked: number;
  totalPdfs: number;
  totalEmailsWithPdf: number;
}

interface Application {
  id: string;
  name: string;
  api_key: string;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  delivery_status?: string | null;
  bounce_type?: string | null;
  bounce_reason?: string | null;
  delivered_at?: string | null;
  bounced_at?: string | null;
  complained_at?: string | null;
  resend_email_id?: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  metadata: any;
  created_at: string;
  parent_log_id: string | null;
  communication_type: string;
  pdf_generated: boolean;
  template_id: string | null;
}

interface PendingCommunication {
  id: string;
  recipient_email: string;
  template_name: string;
  status: string;
  communication_type: string;
  pending_fields: string[];
  external_reference_id: string | null;
  created_at: string;
  updated_at: string;
}

export const Statistics = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalSent: 0, totalFailed: 0, totalPending: 0, totalOpened: 0, totalClicked: 0, totalPdfs: 0, totalEmailsWithPdf: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pendingComms, setPendingComms] = useState<PendingCommunication[]>([]);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState<string | null>(null);
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<string | null>(null);
  const [resendConfirmLog, setResendConfirmLog] = useState<EmailLog | null>(null);
  const [resending, setResending] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [childLogs, setChildLogs] = useState<Record<string, EmailLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchDateStart, setSearchDateStart] = useState('');
  const [searchDateEnd, setSearchDateEnd] = useState('');

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchEmail, searchDateStart, searchDateEnd]);

  useEffect(() => {
    if (selectedApp) {
      loadStats(selectedApp);
      loadLogs(selectedApp);
      loadPendingCommunications(selectedApp);

      const emailLogsChannel = supabase
        .channel(`email_logs_${selectedApp}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_logs',
            filter: `application_id=eq.${selectedApp}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newLog = payload.new as EmailLog;
              if (!newLog.parent_log_id && newLog.communication_type !== 'pdf_generation') {
                setLogs((prev) => [newLog, ...prev]);
              }
              loadStats(selectedApp);
            } else if (payload.eventType === 'UPDATE') {
              setLogs((prev) =>
                prev.map((log) =>
                  log.id === payload.new.id ? (payload.new as EmailLog) : log
                )
              );
              loadStats(selectedApp);
            } else if (payload.eventType === 'DELETE') {
              setLogs((prev) => prev.filter((log) => log.id !== payload.old.id));
              loadStats(selectedApp);
            }
          }
        )
        .subscribe();

      const pendingChannel = supabase
        .channel(`pending_communications_${selectedApp}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_communications',
            filter: `application_id=eq.${selectedApp}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setPendingComms((prev) => [payload.new as PendingCommunication, ...prev]);
              loadStats(selectedApp);
            } else if (payload.eventType === 'UPDATE') {
              setPendingComms((prev) =>
                prev.map((comm) =>
                  comm.id === payload.new.id ? (payload.new as PendingCommunication) : comm
                )
              );
              loadStats(selectedApp);
            } else if (payload.eventType === 'DELETE') {
              setPendingComms((prev) => prev.filter((comm) => comm.id !== payload.old.id));
              loadStats(selectedApp);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(emailLogsChannel);
        supabase.removeChannel(pendingChannel);
      };
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('default_application_id')
        .eq('user_id', user.sub)
        .maybeSingle();

      const { data, error } = await supabase
        .from('applications')
        .select('id, name, api_key')
        .eq('user_id', user.sub)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);

      if (prefs?.default_application_id) {
        setSelectedApp(prefs.default_application_id);
      } else if (data && data.length > 0) {
        setSelectedApp(data[0].id);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (appId: string) => {
    try {
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('status, delivery_status, opened_at, clicked_at, communication_type, pdf_generated')
        .eq('application_id', appId);

      if (error) throw error;

      const { data: pendingData } = await supabase
        .from('pending_communications')
        .select('status')
        .eq('application_id', appId)
        .in('status', ['waiting_data', 'processing', 'pdf_generated']);

      const sent = logs?.filter((l) => l.delivery_status === 'delivered' || (l.status === 'sent' && !l.delivery_status)).length || 0;
      const failed = logs?.filter((l) => l.status === 'failed' || l.delivery_status === 'bounced' || l.delivery_status === 'complained').length || 0;
      const logsPending = logs?.filter((l) => l.status === 'pending' || l.delivery_status === 'delivery_delayed').length || 0;
      const commsPending = pendingData?.length || 0;
      const opened = logs?.filter((l) => l.opened_at !== null).length || 0;
      const clicked = logs?.filter((l) => l.clicked_at !== null).length || 0;
      const pdfs = logs?.filter((l) => l.communication_type === 'pdf' || l.pdf_generated === true).length || 0;
      const emailsWithPdf = logs?.filter((l) => l.communication_type === 'email_with_pdf' || (l.communication_type === 'email' && l.pdf_generated === true)).length || 0;

      setStats({
        totalSent: sent,
        totalFailed: failed,
        totalPending: logsPending + commsPending,
        totalOpened: opened,
        totalClicked: clicked,
        totalPdfs: pdfs,
        totalEmailsWithPdf: emailsWithPdf
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadLogs = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('application_id', appId)
        .is('parent_log_id', null)
        .neq('communication_type', 'pdf_generation')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const loadChildLogs = async (parentId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('parent_log_id', parentId)
        .order('created_at', { ascending: true});

      if (error) throw error;
      setChildLogs(prev => ({ ...prev, [parentId]: data || [] }));
    } catch (error) {
      console.error('Error loading child logs:', error);
    }
  };

  const toggleExpand = async (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
      if (!childLogs[logId]) {
        await loadChildLogs(logId);
      }
    }
    setExpandedLogs(newExpanded);
  };

  const loadPendingCommunications = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('pending_communications')
        .select('*')
        .eq('application_id', appId)
        .in('status', ['waiting_data', 'processing', 'pdf_generated', 'sent', 'failed'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPendingComms(data || []);
    } catch (error) {
      console.error('Error loading pending communications:', error);
    }
  };

  const getEngagementStatus = (log: EmailLog) => {
    if (log.communication_type === 'pdf_generation') return {
      label: 'Generated',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      icon: <FileText className="w-4 h-4" />
    };
    if (log.delivery_status === 'bounced' || log.bounced_at) return {
      label: 'Bounced',
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      icon: <XCircle className="w-4 h-4" />
    };
    if (log.delivery_status === 'complained' || log.complained_at) return {
      label: 'Spam',
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      icon: <XCircle className="w-4 h-4" />
    };
    if (log.status === 'failed') return {
      label: 'Failed',
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      icon: <XCircle className="w-4 h-4" />
    };
    if (log.clicked_at) return {
      label: 'Clicked',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      icon: <MousePointerClick className="w-4 h-4" />
    };
    if (log.opened_at) return {
      label: 'Opened',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      icon: <Eye className="w-4 h-4" />
    };
    if (log.delivery_status === 'delivered' || log.delivered_at) return {
      label: 'Delivered',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: <CheckCircle className="w-4 h-4" />
    };
    if (log.sent_at && log.status === 'sent') return {
      label: 'Sent',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: <CheckCircle className="w-4 h-4" />
    };
    if (log.delivery_status === 'delivery_delayed') return {
      label: 'Delayed',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: <Clock className="w-4 h-4" />
    };
    return {
      label: 'Pending',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: <Clock className="w-4 h-4" />
    };
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDeliveryTime = (created: string, sent: string | null) => {
    if (!sent) return null;
    const createdDate = new Date(created);
    const sentDate = new Date(sent);
    const diff = sentDate.getTime() - createdDate.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const deletePendingCommunication = async () => {
    if (!deleteConfirmPending) return;

    try {
      const { error } = await supabase
        .from('pending_communications')
        .delete()
        .eq('id', deleteConfirmPending);

      if (error) throw error;

      toast.success('Comunicación pendiente eliminada exitosamente');
      setDeleteConfirmPending(null);
      if (selectedApp) {
        loadPendingCommunications(selectedApp);
        loadStats(selectedApp);
      }
    } catch (error) {
      console.error('Error deleting pending communication:', error);
      toast.error('Error al eliminar la comunicación pendiente');
    }
  };

  const deleteEmailLog = async () => {
    if (!deleteConfirmLog) return;

    try {
      const { error } = await supabase
        .from('email_logs')
        .delete()
        .eq('id', deleteConfirmLog);

      if (error) throw error;

      toast.success('Registro de comunicación eliminado exitosamente');
      setDeleteConfirmLog(null);
      if (selectedApp) {
        loadLogs(selectedApp);
        loadStats(selectedApp);
      }
    } catch (error) {
      console.error('Error deleting email log:', error);
      toast.error('Error al eliminar el registro');
    }
  };

  const filteredLogs = logs.filter((log) => {
    const emailMatch = searchEmail === '' ||
      log.recipient_email.toLowerCase().includes(searchEmail.toLowerCase());

    let dateMatch = true;
    if (searchDateStart || searchDateEnd) {
      const logDate = new Date(log.sent_at || log.created_at);

      if (searchDateStart) {
        const startDate = new Date(searchDateStart);
        startDate.setHours(0, 0, 0, 0);
        dateMatch = dateMatch && logDate >= startDate;
      }

      if (searchDateEnd) {
        const endDate = new Date(searchDateEnd);
        endDate.setHours(23, 59, 59, 999);
        dateMatch = dateMatch && logDate <= endDate;
      }
    }

    return emailMatch && dateMatch;
  });

  const resendCommunication = async () => {
    if (!resendConfirmLog || !selectedApp) return;

    setResending(true);
    try {
      const log = resendConfirmLog;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const currentApp = applications.find(app => app.id === selectedApp);
      if (!currentApp) {
        throw new Error('No se encontró la aplicación');
      }

      if (!currentApp.api_key) {
        throw new Error('La aplicación no tiene una API key configurada');
      }

      console.log('Reenviando con API key:', currentApp.api_key);

      if (!log.template_id) {
        throw new Error('El log no tiene un template_id asociado');
      }

      const { data: template, error: templateError } = await supabase
        .from('communication_templates')
        .select('name')
        .eq('id', log.template_id)
        .maybeSingle();

      if (templateError || !template) {
        throw new Error('No se pudo encontrar el template asociado');
      }

      let pdfBase64 = null;
      let pdfFilename = 'document.pdf';

      if (log.pdf_generated) {
        if (log.metadata?.pdf_base64) {
          pdfBase64 = log.metadata.pdf_base64;
          pdfFilename = log.metadata?.pdf_filename || 'document.pdf';
        } else if (log.metadata?.pdf_info?.pdf_log_id) {
          const pdfLogId = log.metadata.pdf_info.pdf_log_id;

          const { data: pdfLog, error: pdfError } = await supabase
            .from('email_logs')
            .select('metadata')
            .eq('id', pdfLogId)
            .eq('communication_type', 'pdf_generation')
            .maybeSingle();

          if (!pdfError && pdfLog?.metadata?.pdf_base64) {
            pdfBase64 = pdfLog.metadata.pdf_base64;
            pdfFilename = log.metadata.pdf_info.pdf_filename || pdfLog.metadata?.pdf_filename || 'document.pdf';
            console.log('PDF recuperado desde log de generación:', pdfLogId);
          } else {
            console.error('No se pudo recuperar el PDF desde el log de generación:', pdfLogId);
          }
        }
      }

      const templateData = log.metadata?.template_data || log.metadata?.data || {};

      const orderId = log.metadata?.order_id;
      const waitForInvoice = log.metadata?.wait_for_invoice;
      const hasPdfInfo = log.metadata?.pdf_info || pdfBase64;

      let endpoint = 'send-email';
      const payload: any = {
        recipient_email: log.recipient_email,
        subject: log.subject,
        template_name: template.name,
        application_id: selectedApp,
        data: templateData
      };

      if (orderId && waitForInvoice && !hasPdfInfo) {
        endpoint = 'pending-communication';
        payload.order_id = orderId;
        payload.wait_for_invoice = true;
      } else if (pdfBase64) {
        payload.pdf_base64 = pdfBase64;
        payload.pdf_filename = pdfFilename;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'x-api-key': currentApp.api_key
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al reenviar comunicación');
      }

      toast.success('Comunicación reenviada exitosamente');
      setResendConfirmLog(null);

      if (selectedApp) {
        loadLogs(selectedApp);
        loadStats(selectedApp);
      }
    } catch (error) {
      console.error('Error resending communication:', error);
      toast.error(error instanceof Error ? error.message : 'Error al reenviar la comunicación');
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <Layout currentPage="statistics">
        <div className="text-center py-12">
          <div className="text-slate-400">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="statistics">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Estadísticas</h1>

        {applications.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 text-center">
            <p className="text-slate-400 mb-4">Primero debes crear una aplicación</p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Ir al Dashboard
            </a>
          </div>
        ) : (
          <>
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app.id)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedApp === app.id
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-5 gap-4">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-400">Enviados</h3>
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalSent}</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-400">Fallidos</h3>
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalFailed}</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-400">Pendientes</h3>
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalPending}</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-400">Abiertos</h3>
                    <Eye className="w-5 h-5 text-cyan-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalOpened}</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-400">Clics</h3>
                    <MousePointerClick className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalClicked}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-purple-300">PDFs Generados</h3>
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalPdfs}</p>
                  <p className="text-xs text-purple-300/70 mt-1">PDFs creados y enviados</p>
                </div>

                <div className="bg-amber-500/10 backdrop-blur-sm rounded-xl border border-amber-500/30 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-amber-300">Emails con PDF</h3>
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.totalEmailsWithPdf}</p>
                  <p className="text-xs text-amber-300/70 mt-1">Emails que incluyen adjuntos PDF</p>
                </div>
              </div>
            </div>


            {pendingComms.length > 0 && (
              <div className="bg-amber-900/20 backdrop-blur-sm rounded-xl border border-amber-700/50 overflow-hidden">
                <div className="p-6 border-b border-amber-700/50">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-amber-300">Comunicaciones Pendientes</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-amber-700/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Destinatario
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Template
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Campos Pendientes
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-700/30">
                      {pendingComms.map((comm) => (
                        <tr key={comm.id} className="hover:bg-amber-700/10 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {comm.status === 'sent' ? (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                <Check className="w-4 h-4" />
                                <span>Enviado</span>
                              </span>
                            ) : comm.status === 'failed' ? (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-400">
                                <XCircle className="w-4 h-4" />
                                <span>Fallido</span>
                              </span>
                            ) : comm.status === 'pdf_generated' ? (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-green-500/20 bg-green-500/10 text-green-400">
                                <FileCheck className="w-4 h-4" />
                                <span>PDF Generado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-amber-500/20 bg-amber-500/10 text-amber-400">
                                <Clock className="w-4 h-4" />
                                <span>{comm.status === 'waiting_data' ? 'Esperando datos' : 'Procesando'}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-amber-200">{comm.recipient_email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-amber-300">{comm.template_name}</div>
                            <div className="text-xs text-amber-400/60">{comm.communication_type}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(comm.pending_fields) && comm.pending_fields.map((field, idx) => (
                                <span key={`field-${comm.id}-${idx}`} className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">
                                  {field}
                                </span>
                              ))}
                              {!Array.isArray(comm.pending_fields) && comm.pending_fields && (
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">
                                  {String(comm.pending_fields)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-amber-400">
                              {formatDate(comm.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => setDeleteConfirmPending(comm.id)}
                              className="p-2 text-amber-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-700 space-y-4">
                <h3 className="text-lg font-semibold text-white">Historial de Comunicaciones</h3>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por correo electrónico..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <input
                      type="date"
                      placeholder="Fecha inicio"
                      value={searchDateStart}
                      onChange={(e) => setSearchDateStart(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <input
                      type="date"
                      placeholder="Fecha fin"
                      value={searchDateEnd}
                      onChange={(e) => setSearchDateEnd(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>

                {(searchEmail || searchDateStart || searchDateEnd) && (
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>
                      Mostrando {filteredLogs.length} de {logs.length} registros
                    </span>
                    <button
                      onClick={() => {
                        setSearchEmail('');
                        setSearchDateStart('');
                        setSearchDateEnd('');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    No hay comunicaciones registradas
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Destinatario
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Asunto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log) => {
                        const engagement = getEngagementStatus(log);
                        const isExpanded = expandedLogs.has(log.id);
                        const children = childLogs[log.id] || [];
                        const hasChildren = log.communication_type === 'email_with_pdf' || (log.pdf_generated && log.communication_type !== 'pdf_generation');

                        return (
                          <React.Fragment key={log.id}>
                            <tr className="hover:bg-slate-700/20 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  {hasChildren && (
                                    <button
                                      onClick={() => toggleExpand(log.id)}
                                      className="p-1 text-slate-400 hover:text-white transition-colors"
                                      title={isExpanded ? "Colapsar" : "Expandir"}
                                    >
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  )}
                                  <span
                                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${engagement.color}`}
                                  >
                                    {engagement.icon}
                                    <span>{engagement.label}</span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-white">{log.recipient_email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-slate-300 max-w-md truncate">{log.subject}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-slate-400">
                                  {formatDate(log.sent_at || log.created_at)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => setSelectedLog(log)}
                                    className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-700/30"
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setResendConfirmLog(log)}
                                    className="p-2 text-slate-400 hover:text-green-400 transition-colors rounded-lg hover:bg-green-900/20"
                                    title="Reenviar comunicación"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmLog(log.id)}
                                    className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && children.map((child) => {
                              const childEngagement = getEngagementStatus(child);
                              return (
                                <tr key={child.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center space-x-2 pl-8">
                                      <span
                                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${childEngagement.color}`}
                                      >
                                        {childEngagement.icon}
                                        <span>{childEngagement.label}</span>
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-300">{child.recipient_email}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="text-sm text-slate-400 max-w-md truncate">{child.subject}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500">
                                      {formatDate(child.sent_at || child.created_at)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => setSelectedLog(child)}
                                        className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-700/30"
                                        title="Ver detalles"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setResendConfirmLog(child)}
                                        className="p-2 text-slate-400 hover:text-green-400 transition-colors rounded-lg hover:bg-green-900/20"
                                        title="Reenviar comunicación"
                                      >
                                        <Send className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmLog(child.id)}
                                        className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
                                        title="Eliminar"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {filteredLogs.length > itemsPerPage && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
                    <div className="text-sm text-slate-400">
                      Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredLogs.length)} a{' '}
                      {Math.min(currentPage * itemsPerPage, filteredLogs.length)} de {filteredLogs.length} registros
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.ceil(filteredLogs.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                          <button
                            key={`page-${page}`}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 rounded-lg transition-colors ${
                              currentPage === page
                                ? 'bg-cyan-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(filteredLogs.length / itemsPerPage), currentPage + 1))}
                        disabled={currentPage === Math.ceil(filteredLogs.length / itemsPerPage)}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {deleteConfirmPending && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Comunicación Pendiente</h3>
            <p className="text-slate-300 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar esta comunicación pendiente? Esta acción no se puede deshacer.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirmPending(null)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deletePendingCommunication}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Registro de Comunicación</h3>
            <p className="text-slate-300 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar este registro del historial? Esta acción no se puede deshacer.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirmLog(null)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteEmailLog}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {resendConfirmLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Reenviar Comunicación</h3>
            <p className="text-slate-300 text-sm mb-4">
              ¿Estás seguro de que deseas reenviar esta comunicación?
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Destinatario:</span>
                <span className="text-white">{resendConfirmLog.recipient_email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Asunto:</span>
                <span className="text-white truncate ml-2">{resendConfirmLog.subject}</span>
              </div>
              {resendConfirmLog.pdf_generated && (
                <div className="flex items-center space-x-2 text-sm">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300">Incluye PDF adjunto</span>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setResendConfirmLog(null)}
                disabled={resending}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={resendCommunication}
                disabled={resending}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {resending ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Reenviar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Detalles de Comunicación</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Estado</label>
                  <span
                    className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${getEngagementStatus(selectedLog).color}`}
                  >
                    <span>{getEngagementStatus(selectedLog).label}</span>
                  </span>
                </div>

                {selectedLog.sent_at && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Tiempo de Entrega</label>
                    <div className="px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white inline-block">
                      {calculateDeliveryTime(selectedLog.created_at, selectedLog.sent_at) || 'N/A'}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Destinatario</label>
                <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                  {selectedLog.recipient_email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Asunto</label>
                <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                  {selectedLog.subject}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Fecha de Creación</label>
                  <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm">
                    {formatDate(selectedLog.created_at)}
                  </div>
                </div>

                {selectedLog.sent_at && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Fecha de Envío</label>
                    <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm">
                      {formatDate(selectedLog.sent_at)}
                    </div>
                  </div>
                )}

                {selectedLog.opened_at && (
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">Fecha de Apertura</label>
                    <div className="px-4 py-2 bg-cyan-900/20 border border-cyan-700/50 rounded-lg text-cyan-300 text-sm">
                      {formatDate(selectedLog.opened_at)}
                    </div>
                  </div>
                )}
              </div>

              {selectedLog.clicked_at && (
                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-2">Fecha de Click</label>
                  <div className="px-4 py-2 bg-blue-900/20 border border-blue-700/50 rounded-lg text-blue-300">
                    {formatDate(selectedLog.clicked_at)}
                  </div>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <label className="block text-sm font-medium text-red-400 mb-2">Error</label>
                  <div className="px-4 py-2 bg-red-900/20 border border-red-700/50 rounded-lg text-red-300">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Metadata</label>
                  <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
