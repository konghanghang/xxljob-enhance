import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Select,
  Tag,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { jobsApi } from '../api/services';
import type { XxlJob, JobGroup } from '../types/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

/**
 * Job List Page Component
 * Displays and manages xxl-job tasks with permission filtering
 */

const JobListPage: React.FC = () => {
  const [jobs, setJobs] = useState<XxlJob[]>([]);
  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<XxlJob | null>(null);
  const navigate = useNavigate();
  const [triggerForm] = Form.useForm();

  // Fetch job groups on mount
  useEffect(() => {
    fetchJobGroups();
  }, []);

  // Fetch jobs when group or pagination changes
  useEffect(() => {
    if (selectedGroup > 0) {
      fetchJobs();
    }
  }, [selectedGroup, pagination.current, pagination.pageSize]);

  const fetchJobGroups = async () => {
    try {
      const response = await jobsApi.getGroups();
      setJobGroups(response.data);
      if (response.data.length > 0) {
        setSelectedGroup(response.data[0].id);
      }
    } catch (error: any) {
      message.error('Failed to load job groups: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const start = (pagination.current - 1) * pagination.pageSize;
      const response = await jobsApi.getList({
        jobGroup: selectedGroup,
        start,
        length: pagination.pageSize,
      });

      setJobs(response.data.data);
      setPagination((prev) => ({ ...prev, total: response.data.recordsFiltered }));
    } catch (error: any) {
      message.error('Failed to load jobs: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = (job: XxlJob) => {
    setSelectedJob(job);
    setTriggerModalVisible(true);
    triggerForm.setFieldsValue({ executorParam: job.executorParam || '' });
  };

  const handleTriggerConfirm = async () => {
    if (!selectedJob) return;

    try {
      const values = await triggerForm.validateFields();
      await jobsApi.trigger(selectedJob.id, {
        executorParam: values.executorParam || undefined,
        addressList: values.addressList || undefined,
      });

      // Close modal first
      setTriggerModalVisible(false);
      triggerForm.resetFields();

      // Show success message after modal is closed
      message.success({
        content: `Job "${selectedJob.jobDesc}" triggered successfully!`,
        duration: 3,
      });
    } catch (error: any) {
      if (error.response) {
        message.error('Failed to trigger job: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleStart = async (job: XxlJob) => {
    try {
      await jobsApi.start(job.id);
      message.success(`Job "${job.jobDesc}" started successfully`);
      fetchJobs();
    } catch (error: any) {
      message.error('Failed to start job: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleStop = async (job: XxlJob) => {
    try {
      await jobsApi.stop(job.id);
      message.success(`Job "${job.jobDesc}" stopped successfully`);
      fetchJobs();
    } catch (error: any) {
      message.error('Failed to stop job: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleViewLogs = (job: XxlJob) => {
    navigate(`/logs?jobId=${job.id}&jobGroup=${job.jobGroup}`);
  };

  const columns: ColumnsType<XxlJob> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Job Description',
      dataIndex: 'jobDesc',
      key: 'jobDesc',
      width: 200,
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
      title: 'Schedule',
      dataIndex: 'scheduleConf',
      key: 'scheduleConf',
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'triggerStatus',
      key: 'triggerStatus',
      width: 100,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? 'Running' : 'Stopped'}
        </Tag>
      ),
    },
    {
      title: 'Last Trigger',
      dataIndex: 'triggerLastTime',
      key: 'triggerLastTime',
      width: 150,
      render: (time: number) =>
        time > 0 ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: 'Next Trigger',
      dataIndex: 'triggerNextTime',
      key: 'triggerNextTime',
      width: 150,
      render: (time: number) =>
        time > 0 ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTrigger(record)}
          >
            Trigger
          </Button>
          {record.triggerStatus === 0 ? (
            <Popconfirm
              title="Start this job?"
              onConfirm={() => handleStart(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
              >
                Start
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Stop this job?"
              onConfirm={() => handleStop(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<PauseCircleOutlined />}
              >
                Stop
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewLogs(record)}
          >
            Logs
          </Button>
        </Space>
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
            Job List
          </Title>
          <Select
            style={{ width: 200 }}
            placeholder="Select Job Group"
            value={selectedGroup}
            onChange={setSelectedGroup}
            options={jobGroups.map((group) => ({
              label: `${group.title} (${group.appname})`,
              value: group.id,
            }))}
          />
        </Space>
        <Button type="primary" onClick={fetchJobs}>
          Refresh
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} jobs`,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize: pageSize || 10 });
          },
        }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={`Trigger Job: ${selectedJob?.jobDesc}`}
        open={triggerModalVisible}
        onOk={handleTriggerConfirm}
        onCancel={() => {
          setTriggerModalVisible(false);
          triggerForm.resetFields();
        }}
        okText="Trigger"
      >
        <Form form={triggerForm} layout="vertical">
          <Form.Item
            label="Executor Parameter"
            name="executorParam"
            tooltip="Optional parameter to pass to the executor"
          >
            <TextArea rows={3} placeholder="Enter executor parameter (optional)" />
          </Form.Item>
          <Form.Item
            label="Address List"
            name="addressList"
            tooltip="Optional comma-separated list of executor addresses"
          >
            <Input placeholder="e.g., 192.168.1.1:9999,192.168.1.2:9999" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default JobListPage;
