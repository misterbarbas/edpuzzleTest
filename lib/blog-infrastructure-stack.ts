import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class BlogInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Defining the vpc with public subnet and private
    const vpc = new ec2.Vpc(this, 'BlogVpc', {
      maxAzs: 3, // For HA accross multiple zones
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
      ],
    });
      //Defining the ec2 instance
    const ec2Instance = new ec2.Instance(this, 'BlogInstance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      vpc,
    });

      //Defining the RDS for the dynamic content such user comments, blogs etc
    //const dbInstance = new rds.DatabaseInstance(this, 'BlogDatabase', {
      //engine: rds.DatabaseInstanceEngine.postgres({
        //version: rds.PostgresEngineVersion.VER_13_3,
      //}),
      //vpc,
      //multiAz: true,
      //allocatedStorage: 20, // Customize as needed
      //publiclyAccessible: false,
      //databaseName: 'blogDB',
    //});
      // Defining s3 bucket for static content

      const staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
      });
      //I decided to put CF to cache static content and increse performance

      new cloudfront.CloudFrontWebDistribution(this, 'BlogCloudFront', {
        originConfigs: [{
          s3OriginSource: {
            s3BucketSource: staticAssetsBucket,
          },
          behaviors: [{ isDefaultBehavior: true }],
        }],
      });
      
      //An application loadbalancer to distribute the workloads

      const lb = new elb.ApplicationLoadBalancer(this, 'BlogLoadBalancer', {
        vpc,
        internetFacing: true,
      });
      
      // To configure the domain of the website

      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: 'edblog.com',
      });
      
      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: 'www',
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(lb)),
      });
      

    
    
  }
}
