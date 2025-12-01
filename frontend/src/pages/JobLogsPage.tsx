import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Table,
  Select,
  Space,
  Tag,
  Button,
  Typography,
  message,
  Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { jobsApi } from '../api/services';
import type { XxlJobLog, JobGroup } from '../types/api';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

/**
 * Job Logs Page Component
 * Displays execution logs for xxl-job tasks
 */

const JobLogsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState<XxlJobLog[]>([]);
  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number>(0);
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [logDetailModal, setLogDetailModal] = useState<{ visible: boolean; log: any }>({
    visible: false,
    log: null,
  });

  // Initialize from URL params
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    const jobGroup = searchParams.get('jobGroup');

    if (jobId) setSelectedJobId(Number(jobId));
    if (jobGroup) setSelectedGroup(Number(jobGroup));
  }, [searchParams]);

  // Fetch job groups on mount
  useEffect(() => {
    fetchJobGroups();
  }, []);

  // Fetch jobs when group changes
  useEffect(() => {
    if (selectedGroup > 0) {
      fetchJobs();
    }
  }, [selectedGroup]);

  // Fetch logs when filters change
  useEffect(() => {
    if (selectedGroup > 0 && selectedJobId) {
      fetchLogs();
    }
  }, [selectedGroup, selectedJobId, pagination.current, pagination.pageSize]);

  const fetchJobGroups = async () => {
    try {
      const response = await jobsApi.getGroups();
      setJobGroups(response.data);
      if (response.data.length > 0 && selectedGroup === 0) {
        setSelectedGroup(response.data[0].id);
      }
    } catch (error: any) {
      message.error('Failed to load job groups: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchJobs = async () => {
    setJobsLoading(true);
    try {
      const response = await jobsApi.getList({
        jobGroup: selectedGroup,
        start: 0,
        length: 10000, // Get all jobs
      });
      setJobs(response.data.data);
    } catch (error: any) {
      message.error('Failed to load jobs: ' + (error.response?.data?.message || error.message));
    } finally {
      setJobsLoading(false);
    }
  };

  const handleGroupChange = (groupId: number) => {
    setSelectedGroup(groupId);
    // Clear job selection and logs when switching groups
    setSelectedJobId(undefined);
    setLogs([]);
    setPagination({ current: 1, pageSize: 20, total: 0 });
  };

  const fetchLogs = async () => {
    if (!selectedJobId) return;

    setLoading(true);
    try {
      const start = (pagination.current - 1) * pagination.pageSize;
      const response = await jobsApi.getLogs(selectedJobId, {
        start,
        length: pagination.pageSize,
      });

      setLogs(response.data.data);
      setPagination((prev) => ({ ...prev, total: response.data.recordsFiltered }));
    } catch (error: any) {
      message.error('Failed to load logs: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (log: XxlJobLog) => {
    try {
      const response = await jobsApi.getLogDetail(log.jobId, log.id);
      setLogDetailModal({ visible: true, log: response.data });
    } catch (error: any) {
      message.error('Failed to load log detail: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusTag = (code: number) => {
    if (code === 200) return <Tag color="success">Success</Tag>;
    if (code === 500) return <Tag color="error">Failed</Tag>;
    if (code === 0) return <Tag color="processing">Running</Tag>;
    return <Tag>{code}</Tag>;
  };

  const columns: ColumnsType<XxlJobLog> = [
    {
      title: 'Log ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Job ID',
      dataIndex: 'jobId',
      key: 'jobId',
      width: 80,
    },
    {
      title: 'Executor Address',
      dataIndex: 'executorAddress',
      key: 'executorAddress',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Handler',
      dataIndex: 'executorHandler',
      key: 'executorHandler',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Trigger Time',
      dataIndex: 'triggerTime',
      key: 'triggerTime',
      width: 170,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Trigger Status',
      dataIndex: 'triggerCode',
      key: 'triggerCode',
      width: 120,
      render: (code: number) => getStatusTag(code),
    },
    {
      title: 'Handle Time',
      dataIndex: 'handleTime',
      key: 'handleTime',
      width: 170,
      render: (time: string) =>
        time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: 'Handle Status',
      dataIndex: 'handleCode',
      key: 'handleCode',
      width: 120,
      render: (code: number) => (code ? getStatusTag(code) : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
      >
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            Job Logs
          </Title>
          <Select
            style={{ width: 200 }}
            placeholder="Select Job Group"
            value={selectedGroup || undefined}
            onChange={handleGroupChange}
            options={jobGroups.map((group) => ({
              label: `${group.title} (${group.appname})`,
              value: group.id,
            }))}
          />
          <Select
            style={{ width: 300 }}
            placeholder="Select Job"
            value={selectedJobId}
            onChange={setSelectedJobId}
            allowClear
            showSearch
            loading={jobsLoading}
            disabled={!selectedGroup || jobsLoading}
            optionFilterProp="label"
            options={jobs.map((job) => ({
              label: `#${job.id} - ${job.jobDesc}`,
              value: job.id,
            }))}
          />
        </Space>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={fetchLogs}
        >
          Refresh
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} logs`,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize: pageSize || 20 });
          },
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="Log Detail"
        open={logDetailModal.visible}
        onCancel={() => setLogDetailModal({ visible: false, log: null })}
        footer={[
          <Button
            key="close"
            onClick={() => setLogDetailModal({ visible: false, log: null })}
          >
            Close
          </Button>,
        ]}
        width={800}
      >
        {logDetailModal.log && (
          <div>
            <Paragraph>
              <strong>Trigger Message:</strong>
              <br />
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {logDetailModal.log.triggerMsg || 'N/A'}
              </pre>
            </Paragraph>
            <Paragraph>
              <strong>Handle Message:</strong>
              <br />
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {logDetailModal.log.handleMsg || 'N/A'}
              </pre>
            </Paragraph>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default JobLogsPage;
